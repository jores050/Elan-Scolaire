import { after, NextResponse } from "next/server";
import { getPracticeSubmissionStatus, updateSubmissionProcessingStatus, updateSubmissionValidation } from "@/lib/app-data";
import { processPracticeSubmission } from "@/lib/practice-processing";

export async function POST(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await context.params;

  try {
    const status = await getPracticeSubmissionStatus(submissionId);
    if (!status) {
      return NextResponse.json({ ok: false, error: "Soumission introuvable." }, { status: 404 });
    }

    if (status.processing_status === "completed") {
      return NextResponse.json({
        ok: true,
        redirectTo: "/app/travaux?uploaded=1",
      });
    }

    if (status.processing_status === "processing" || status.processing_status === "pending") {
      return NextResponse.json({
        ok: true,
        redirectTo: `/app/travaux/analyse?submission=${submissionId}`,
      });
    }

    await updateSubmissionProcessingStatus({
      submissionId,
      processingStatus: "pending",
      processingError: null,
      processingStartedAt: null,
      processingCompletedAt: null,
    });
    await updateSubmissionValidation({
      submissionId,
      validationStatus: null,
      validationConfidence: null,
      validationReason: null,
      validationPayload: { state: "pending_validation" },
      validationProvider: null,
      validatedAt: null,
      validationConfirmedAt: null,
    });

    after(async () => {
      await processPracticeSubmission(submissionId);
    });

    if (request.headers.get("x-elan-ajax") === "1") {
      return NextResponse.json({
        ok: true,
        redirectTo: `/app/travaux/analyse?submission=${submissionId}`,
      });
    }

    return NextResponse.redirect(new URL(`/app/travaux/analyse?submission=${submissionId}`, request.url), 303);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 500;
    if (status === 401) {
      return NextResponse.json({ ok: false, redirectTo: "/connexion?next=/app/travaux", error: "Session expirée." }, { status: 401 });
    }
    if (status === 403) {
      return NextResponse.json({ ok: false, error: "Vous ne pouvez pas relancer cette soumission." }, { status: 403 });
    }
    throw error;
  }
}
