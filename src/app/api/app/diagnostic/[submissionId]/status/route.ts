import { NextResponse } from "next/server";
import { getDiagnosticSubmissionStatus } from "@/lib/app-data";

export async function GET(_request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await context.params;

  try {
    const status = await getDiagnosticSubmissionStatus(submissionId);
    if (!status) {
      return NextResponse.json({ ok: false, error: "Diagnostic introuvable." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      submissionId: status.id,
      processingStatus: status.processing_status,
      processingError: status.processing_error,
      processingStartedAt: status.processing_started_at,
      processingCompletedAt: status.processing_completed_at,
      validationStatus: status.validation_status,
      validationConfidence: status.validation_confidence,
      validationReason: status.validation_reason,
      validationPayload: status.validation_payload ?? {},
      validationProvider: status.validation_provider,
      validatedAt: status.validated_at,
      validationConfirmedAt: status.validation_confirmed_at,
      analysisId: status.analysis_id,
      redirectTo:
        status.processing_status === "completed"
          ? `/app/diagnostic/resultat?submission=${status.id}`
          : null,
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 500;
    if (status === 401) {
      return NextResponse.json({ ok: false, redirectTo: "/connexion?next=/app/diagnostic", error: "Session expirée." }, { status: 401 });
    }
    if (status === 403) {
      return NextResponse.json({ ok: false, error: "Vous ne pouvez pas consulter ce diagnostic." }, { status: 403 });
    }
    throw error;
  }
}
