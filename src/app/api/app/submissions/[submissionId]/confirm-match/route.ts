import { after, NextResponse } from "next/server";
import { getOwnedSubmissionById, updateSubmissionProcessingStatus, updateSubmissionValidation } from "@/lib/app-data";
import { processDiagnosticSubmission } from "@/lib/diagnostic-processing";
import { processPracticeSubmission } from "@/lib/practice-processing";

export async function POST(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await context.params;
  const isAjaxRequest = request.headers.get("x-elan-ajax") === "1";

  try {
    const submission = await getOwnedSubmissionById(submissionId);
    if (!submission) {
      return NextResponse.json({ ok: false, error: "Soumission introuvable." }, { status: 404 });
    }

    if (submission.validation_status !== "PARTIAL_MATCH") {
      return NextResponse.json({ ok: false, error: "Cette soumission ne nécessite pas de confirmation manuelle." }, { status: 409 });
    }

    const confirmedAt = new Date().toISOString();
    await updateSubmissionValidation({
      submissionId,
      validationStatus: "PARTIAL_MATCH",
      validationConfidence: submission.validation_confidence === "high" || submission.validation_confidence === "medium" || submission.validation_confidence === "low"
        ? submission.validation_confidence
        : null,
      validationReason: submission.validation_reason,
      validationPayload: submission.validation_payload && typeof submission.validation_payload === "object"
        ? {
          ...(submission.validation_payload as Record<string, unknown>),
          decision: "allow_analysis_after_parent_confirmation",
        }
        : { decision: "allow_analysis_after_parent_confirmation" },
      validationProvider: submission.validation_provider,
      validatedAt: submission.validated_at,
      validationConfirmedAt: confirmedAt,
    });

    await updateSubmissionProcessingStatus({
      submissionId,
      processingStatus: "pending",
      processingError: null,
      processingStartedAt: null,
      processingCompletedAt: null,
    });

    if (submission.submission_kind === "diagnostic") {
      after(async () => {
        await processDiagnosticSubmission(submissionId);
      });
      const redirectTo = `/app/diagnostic/analyse?submission=${submissionId}`;
      if (isAjaxRequest) {
        return NextResponse.json({ ok: true, redirectTo });
      }
      return NextResponse.redirect(new URL(redirectTo, request.url), 303);
    }

    after(async () => {
      await processPracticeSubmission(submissionId);
    });

    const redirectTo = `/app/travaux/analyse?submission=${submissionId}`;
    if (isAjaxRequest) {
      return NextResponse.json({ ok: true, redirectTo });
    }
    return NextResponse.redirect(new URL(redirectTo, request.url), 303);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 500;
    if (status === 401) {
      return NextResponse.json({ ok: false, redirectTo: "/connexion?next=/app/travaux", error: "Session expirée." }, { status: 401 });
    }
    if (status === 403) {
      return NextResponse.json({ ok: false, error: "Vous ne pouvez pas confirmer cette soumission." }, { status: 403 });
    }
    throw error;
  }
}
