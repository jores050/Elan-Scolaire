import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { WorkUploadForm } from "@/components/work-upload-form";
import { getStudentSelectionForParent } from "@/lib/active-student";
import { getLatestCompletedDiagnosticSubmissionForStudent, getLatestDiagnosticSubmissionForStudent } from "@/lib/app-data";
import { requireParentAccess } from "@/lib/auth";

const errorMessages: Record<string, string> = {
  files: "Veuillez choisir un fichier plus petit : 4 MB maximum.",
  upload: "L’envoi du diagnostic n’a pas pu être terminé. Réessayez avec un fichier plus léger.",
  forbidden: "Vous ne pouvez pas envoyer ce diagnostic depuis ce compte.",
};

export default async function DiagnosticPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  const user = await requireParentAccess({ requireStudent: true });
  if (user.role !== "parent") redirect("/admin");
  const { activeStudent: student } = await getStudentSelectionForParent(user.id);
  if (!student) redirect("/app/ajouter-eleve");
  const [latestSubmission, latestCompletedSubmission] = await Promise.all([
    getLatestDiagnosticSubmissionForStudent(student.id),
    getLatestCompletedDiagnosticSubmissionForStudent(student.id),
  ]);

  return (
    <AppShell title="Diagnostic initial">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="card">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Étape 1 du parcours ÉLAN</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-950">Commencer le diagnostic papier</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
            <p>Le diagnostic se fait dans le guide. L’application ne contient pas le questionnaire.</p>
            <p>1. Ouvrez le Guide Diagnostic & Révision.</p>
            <p>2. Laissez votre enfant répondre sur papier.</p>
            <p>3. Photographiez ou scannez les feuilles complétées.</p>
            <p>4. Envoyez-les ici pour obtenir un résultat structuré par notion.</p>
          </div>
        </section>

        <section className="card">
          <h3 className="text-xl font-bold text-slate-950">Scanner les feuilles du diagnostic</h3>
          <p className="mt-2 text-sm text-slate-600">Formats acceptés : jpg, jpeg, png, webp, pdf. Chaque fichier doit faire 4 MB maximum.</p>
          <WorkUploadForm
            studentId={student.id}
            submissionKind="diagnostic"
            serverError={errorMessages[error]}
            title="Photos ou PDF du diagnostic"
            commentPlaceholder="Précisez si certaines pages sont absentes, floues ou si l’enfant a sauté une partie."
            submitLabel="Envoyer le diagnostic"
          />
        </section>

        {latestSubmission ? (
          <section className="card">
            <h3 className="text-xl font-bold text-slate-950">Suivi du dernier diagnostic</h3>
            <div className="mt-4 flex flex-wrap gap-3">
              {latestSubmission.processing_status === "completed" ? (
                <Link href={`/app/diagnostic/resultat?submission=${latestSubmission.id}`} className="btn-primary">Voir le résultat terminé</Link>
              ) : (
                <Link href={`/app/diagnostic/analyse?submission=${latestSubmission.id}`} className="btn-primary">Reprendre l’analyse</Link>
              )}
              {latestCompletedSubmission ? (
                <Link href={`/app/diagnostic/resultat?submission=${latestCompletedSubmission.id}`} className="btn-secondary">Dernier résultat validé</Link>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
