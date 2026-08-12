import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/cards";
import { requireUser } from "@/lib/auth";
import { getProgressSummary, listStudentsForParent, listSubmissionsWithAnalyses } from "@/lib/app-data";

export default async function ProgressionPage() {
  const user = await requireUser();
  if (user.role !== "parent") redirect("/admin");
  const student = (await listStudentsForParent(user.id))[0];
  if (!student) redirect("/app");

  const summary = await getProgressSummary(student.id);
  const submissions = await listSubmissionsWithAnalyses(student.id);
  const analysed = submissions.filter((submission) => submission.ai_analyses?.[0]);
  const averageScore = analysed.length
    ? `${(analysed.reduce((sum, submission) => sum + Number(submission.ai_analyses?.[0]?.score ?? 0), 0) / analysed.length).toFixed(1)}/20`
    : "—";
  const recommendation = summary.weak[0]
    ? `Priorité cette semaine : ${summary.weak[0]}.`
    : summary.mastered[0]
      ? `Bonne dynamique : ${summary.mastered[0]} est déjà bien engagé.`
      : "Envoyez un premier travail pour débloquer le suivi détaillé.";

  return (
    <AppShell title="Rapport parent">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Notions suivies" value={String(summary.trackedTopics)} />
        <MetricCard label="Notions maîtrisées" value={String(summary.mastered.length)} />
        <MetricCard label="Travaux envoyés" value={String(submissions.length)} />
        <MetricCard label="Résultat moyen" value={averageScore} />
        <MetricCard label="Progression" value={`${summary.percentage} %`} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-950">Notions maîtrisées</h2>
          {summary.mastered.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">Aucune notion validée pour le moment.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {summary.mastered.map((item) => <li key={item}>- {item}</li>)}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-slate-950">À renforcer</h2>
          {summary.weak.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">Aucune alerte détectée pour l’instant.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {summary.weak.map((item) => <li key={item}>- {item}</li>)}
            </ul>
          )}
          <p className="mt-4 text-sm text-slate-600">{recommendation}</p>
        </div>
      </div>
    </AppShell>
  );
}
