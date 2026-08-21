import { analyzeSubmission } from "@/lib/analysis";
import { updateAnnualProgressAfterAnalysis } from "@/lib/annual-program";
import {
  claimPracticeSubmissionProcessing,
  getSubmissionForBackgroundProcessing,
  updateSubmissionProcessingStatus,
  updateSubmissionValidation,
} from "@/lib/app-data";
import { updatePretProgramProgressAfterAnalysis } from "@/lib/pret-program";
import { buildPedagogicalContextFromExpectedContext } from "@/lib/submission-context";
import { parseExpectedSubmissionContext, type SubmissionValidationOutcome, validateSubmissionMatch } from "@/lib/submission-match";
import { loadStoredSubmissionFiles } from "@/lib/storage";

function toFailureMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim().slice(0, 500);
  return "L'analyse du travail a échoué. Réessayez avec des images plus nettes ou un nouveau PDF.";
}

function toValidationPayload(result: SubmissionValidationOutcome) {
  return {
    decision: result.decision,
    unavailable: result.unavailable,
    detected_document_type: result.detectedDocumentType,
    detected_day_reference: result.detectedDayReference,
    detected_page_reference: result.detectedPageReference,
    detected_reference_ids: result.detectedReferenceIds,
    detected_topic_slugs: result.detectedTopicSlugs,
    visible_exercise_numbers: result.visibleExerciseNumbers,
    evidence: result.evidence,
  };
}

export async function processPracticeSubmission(submissionId: string) {
  const claimed = await claimPracticeSubmissionProcessing(submissionId);
  if (!claimed) {
    return { ok: false as const, reason: "already-processing-or-finished" };
  }

  try {
    const payload = await getSubmissionForBackgroundProcessing(submissionId);
    if (!payload || payload.submission.submission_kind !== "practice") {
      throw new Error("Soumission pratique introuvable pour le traitement.");
    }

    const expectedContext = parseExpectedSubmissionContext(payload.submission.reference_payload);
    if (!expectedContext) {
      throw new Error("Contexte attendu de la soumission introuvable. Merci de renvoyer le travail.");
    }
    if (expectedContext.reference_lookup_status === "reference_not_found") {
      throw new Error("REFERENCE_NOT_FOUND: la référence pédagogique attendue n'existe pas dans le référentiel officiel. Aucune progression n'a été mise à jour.");
    }

    const files = await loadStoredSubmissionFiles({
      parentUserId: payload.student.parent_user_id,
      studentId: payload.student.id,
      submissionId,
      storagePaths: payload.submission.storage_paths,
    });

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
        validationPayload: toValidationPayload(validation),
        validationProvider: validation.provider,
        validatedAt: new Date().toISOString(),
        validationConfirmedAt: payload.submission.validation_confirmed_at,
      });

      if (validation.decision === "retry") {
        throw new Error("La vérification automatique de la copie est temporairement indisponible. Réessayez dans quelques instants.");
      }
      if (validation.decision === "needs_confirmation") {
        throw new Error("La copie semble correspondre partiellement au travail attendu. Merci de confirmer manuellement avant l’analyse.");
      }
      if (validation.submissionStatus === "UNREADABLE") {
        throw new Error("La copie est trop peu lisible pour être analysée. Merci de renvoyer des images plus nettes ou un PDF plus propre.");
      }
      if (validation.submissionStatus === "MISMATCH") {
        throw new Error("La copie envoyée ne correspond pas clairement au travail attendu.");
      }
    }

    const primaryTopicSlug = expectedContext.expected_topic_slugs[0] ?? payload.student.current_topic_slug;
    const analysisStudent = primaryTopicSlug && primaryTopicSlug !== payload.student.current_topic_slug
      ? { ...payload.student, current_topic_slug: primaryTopicSlug }
      : payload.student;

    const analysis = await analyzeSubmission(analysisStudent, payload.submission, files, {
      analysisKind: "practice",
      pedagogicalContext: buildPedagogicalContextFromExpectedContext(expectedContext),
      persistProgress: expectedContext.progression_eligible,
    });

    if (expectedContext.progression_eligible) {
      await updatePretProgramProgressAfterAnalysis({
        submissionId,
        studentId: payload.student.id,
        programDayId: expectedContext.program_day_id,
        programItemId: expectedContext.program_item_id,
        score: analysis.score,
        status: analysis.status,
      });
      await updateAnnualProgressAfterAnalysis({
        submissionId,
        studentId: payload.student.id,
        annualWeekId: expectedContext.annual_week_id,
        annualWeekItemId: expectedContext.annual_week_item_id,
        score: analysis.score,
        status: analysis.status,
        provider: analysis.provider,
      });
    }

    await updateSubmissionProcessingStatus({
      submissionId,
      processingStatus: "completed",
      processingError: null,
      processingStartedAt: claimed.processing_started_at ?? new Date().toISOString(),
      processingCompletedAt: new Date().toISOString(),
    });

    return { ok: true as const, analysisId: String(analysis.id) };
  } catch (error) {
    await updateSubmissionProcessingStatus({
      submissionId,
      processingStatus: "failed",
      processingError: toFailureMessage(error),
      processingStartedAt: claimed.processing_started_at ?? new Date().toISOString(),
      processingCompletedAt: new Date().toISOString(),
    });
    return { ok: false as const, reason: "failed" };
  }
}

export async function processConfirmedPracticeSubmission(submissionId: string) {
  return processPracticeSubmission(submissionId);
}
