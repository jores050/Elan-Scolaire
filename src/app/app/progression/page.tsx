import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/cards";
import { requireUser } from "@/lib/auth";
import { getProgressSummary, listStudentsForParent } from "@/lib/app-data";

export default async function ProgressionPage() {
  const user = await requireUser();
  if (user.role !== "parent") redirect("/admin");
  const student = (await listStudentsForParent(user.id))[0];
  if (!student) redirect("/app");
  const summary = await getProgressSummary(student.id);
  return (
    <AppShell title="Rapport parent">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Travail réalisé" value="4/5 séances" />
        <MetricCard label="Temps" value="2 h 10" />
        <MetricCard label="Exercices réalisés" value="18" />
        <MetricCard label="Résultat moyen" value="14/20" />
        <MetricCard label="Progression" value={`+${Math.max(summary.percentage - 40, 4)} %`} />
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-950">Notions maîtrisées</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {summary.mastered.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-950">À renforcer</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {summary.weak.map((item) => <li key={item}>- {item}</li>)}
          </ul>
          <p className="mt-4 text-sm text-slate-600">Recommandation : cette semaine, concentrez-vous sur Thalès avant de poursuivre.</p>
        </div>
      </div>
    </AppShell>
  );
}
