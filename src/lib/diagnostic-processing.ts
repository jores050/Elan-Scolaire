import { analyzeSubmission } from "@/lib/analysis";
import {
  addNotificationIfAbsent,
  claimDiagnosticSubmissionProcessing,
  getSubmissionForBackgroundProcessing,
  updateSubmissionProcessingStatus,
  updateSubmissionValidation,
} from "@/lib/app-data";
import { persistPretProgramSnapshotFromAnalysis } from "@/lib/pret-program";
import { buildPedagogicalContextFromExpectedContext } from "@/lib/submission-context";
import { parseExpectedSubmissionContext, validateSubmissionMatch } from "@/lib/submission-match";
import { loadStoredSubmissionFiles } from "@/lib/storage";

function toFailureMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim().slice(0, 500);
  return "L'analyse du diagnostic a échoué. Réessayez avec des images plus nettes ou un nouveau PDF.";
}

export async function processDiagnosticSubmission(submissionId: string) {
  const claimed = await claimDiagnosticSubmissionProcessing(submissionId);
  if (!claimed) {
    return { ok: false as const, reason: "already-processing-or-finished" };
  }

  try {
    const payload = await getSubmissionForBackgroundProcessing(submissionId);
    if (!payload) {
      throw new Error("Soumission diagnostic introuvable pour le traitement.");
    }

    const files = await loadStoredSubmissionFiles({
      parentUserId: payload.student.parent_user_id,
      studentId: payload.student.id,
      submissionId,
      storagePaths: payload.submission.storage_paths,
    });

    const expectedContext = parseExpectedSubmissionContext(payload.submission.reference_payload);
    if (!expectedContext) {
      throw new Error("Contexte attendu du diagnostic introuvable. Merci de renvoyer la copie.");
    }
    if (expectedContext.reference_lookup_status === "reference_not_found") {
      throw new Error("REFERENCE_NOT_FOUND: le diagnostic attendu n'a pas été retrouvé dans le référentiel officiel. Aucune mise à jour pédagogique n'a été enregistrée.");
    }

    const confirmationAlreadyGiven = payload.submission.validation_status === "PARTIAL_MATCH"
      && Boolean(payload.submission.validation_confirmed_at);

    if (!confirmationAlreadyGiven) {
      const validation = await validateSubmissionMatch({
        expectedContext,
        files,
        comment: payload.submission.comment,
        fileNames: payload.submission.file_names,
      });

      await updateSubmissionValidation({
        submissionId,
        validationStatus: validation.submissionStatus,
        validationConfidence: validation.confidence,
        validationReason: validation.reason,
        validationPayload: {
          decision: validation.decision,
          unavailable: validation.unavailable,
          detected_document_type: validation.detectedDocumentType,
          detected_day_reference: validation.detectedDayReference,
          detected_page_reference: validation.detectedPageReference,
          detected_reference_ids: validation.detectedReferenceIds,
          detected_topic_slugs: validation.detectedTopicSlugs,
          visible_exercise_numbers: validation.visibleExerciseNumbers,
          evidence: validation.evidence,
        },
        validationProvider: validation.provider,
        validatedAt: new Date().toISOString(),
        validationConfirmedAt: payload.submission.validation_confirmed_at,
      });

      if (validation.decision === "retry") {
        throw new Error("La vérification automatique du diagnostic est temporairement indisponible. Réessayez dans quelques instants.");
      }
      if (validation.decision === "needs_confirmation") {
        throw new Error("La copie semble correspondre partiellement au diagnostic. Merci de confirmer manuellement avant l’analyse.");
      }
      if (validation.submissionStatus === "UNREADABLE") {
        throw new Error("La copie du diagnostic est trop peu lisible. Merci de renvoyer des images plus nettes ou un PDF plus propre.");
      }
      if (validation.submissionStatus === "MISMATCH") {
        throw new Error("La copie envoyée ne correspond pas clairement au diagnostic initial attendu.");
      }
    }

    const analysis = await analyzeSubmission(payload.student, payload.submission, files, {
      analysisKind: "diagnostic",
      pedagogicalContext: buildPedagogicalContextFromExpectedContext(expectedContext),
    });

    await persistPretProgramSnapshotFromAnalysis({
      studentId: payload.student.id,
      analysisId: String(analysis.id),
      latestDiagnosticAnalysis: analysis,
    });

    await addNotificationIfAbsent({
      userId: payload.student.parent_user_id,
      studentId: payload.student.id,
      type: "programme_pret",
      message: `Le programme personnalisé de ${payload.student.first_name} est prêt. Vous pouvez démarrer les séances de révision.`,
      dedupeKey: `programme-pret:${payload.student.id}:${analysis.id}`,
    });

    await updateSubmissionProcessingStatus({
      submissionId,
      processingStatus: "completed",
      processingStartedAt: claimed.processing_started_at ?? new Date().toISOString(),
      processingCompletedAt: new Date().toISOString(),
      processingError: null,
    });

    return { ok: true as const, analysisId: String(analysis.id) };
  } catch (error) {
    console.error("[diagnostic-processing] Background analysis failed", {
      submissionId,
      error,
    });

    await updateSubmissionProcessingStatus({
      submissionId,
      processingStatus: "failed",
      processingCompletedAt: new Date().toISOString(),
      processingError: toFailureMessage(error),
    });

    return { ok: false as const, reason: "failed" };
  }
}
