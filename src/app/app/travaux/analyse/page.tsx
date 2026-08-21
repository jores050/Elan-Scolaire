import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PracticeAnalysisStatus } from "@/components/practice-analysis-status";
import { getStudentSelectionForParent } from "@/lib/active-student";
import { getLatestPracticeSubmissionForStudent, getPracticeSubmissionStatus } from "@/lib/app-data";
import { requireParentAccess } from "@/lib/auth";

export default async function TravauxAnalysePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedSubmissionId = typeof params.submission === "string" ? params.submission : "";
  const user = await requireParentAccess({ requireStudent: true });
  if (user.role !== "parent") redirect("/admin");
  const { activeStudent: student } = await getStudentSelectionForParent(user.id);
  if (!student) redirect("/app/ajouter-eleve");

  const fallbackSubmission = await getLatestPracticeSubmissionForStudent(student.id);
  const submissionId = requestedSubmissionId || fallbackSubmission?.id;
  if (!submissionId) redirect("/app/envoyer-travail");

  const status = await getPracticeSubmissionStatus(submissionId);
  if (!status) redirect("/app/envoyer-travail");
  if (status.processing_status === "completed") {
    redirect("/app/travaux?uploaded=1");
  }

  return (
    <AppShell title="Analyse du travail">
      <div className="mx-auto max-w-3xl">
        <PracticeAnalysisStatus
          submissionId={submissionId}
          initialStatus={status.processing_status}
          initialValidationStatus={(status.validation_status as "MATCH" | "PARTIAL_MATCH" | "MISMATCH" | "UNREADABLE" | null) ?? null}
          initialValidationConfidence={(status.validation_confidence as "high" | "medium" | "low" | null) ?? null}
          initialValidationReason={status.validation_reason ?? null}
          initialValidationConfirmedAt={status.validation_confirmed_at ?? null}
        />
      </div>
    </AppShell>
  );
}
