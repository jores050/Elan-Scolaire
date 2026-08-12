import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MetricCard, Pill } from "@/components/cards";
import { requireUser } from "@/lib/auth";
import { getLatestAnalysisForStudent, getProgressSummary, getRecommendation, listStudentsForParent } from "@/lib/app-data";
import { topicLabels } from "@/lib/topics";

export default async function ParentDashboardPage() {
  const user = await requireUser();
  if (user.role !== "parent") redirect("/admin");
  const student = (await listStudentsForParent(user.id))[0];
  if (!student) redirect("/inscription");
  const recommendation = await getRecommendation(student);
  const summary = await getProgressSummary(student.id);
  const latest = await getLatestAnalysisForStudent(student.id);

  return (
    <AppShell title={`Bonjour ${user.fullName}`}>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="card">
            <p className="text-sm text-slate-500">Aujourd’hui</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950">{recommendation.topicLabel}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {recommendation.exercises[0]?.instructions ?? "Guide Prêt pour la 3e · exercices recommandés"} · ≈ {recommendation.estimatedMinutes} minutes
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/app/eleve" className="btn-primary">Voir le travail</Link>
              <Pill tone="blue">{recommendation.band}</Pill>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Progression" value={`${summary.percentage} %`} hint="Vue globale des notions travaillées" />
            <MetricCard label="Dernier résultat" value={`${latest?.score ?? 14}/20`} hint={latest?.conseilParent ?? "Bonne progression. Il faut encore renforcer les équations."} />
            <MetricCard label="À renforcer" value={summary.weak.slice(0, 3).join(", ") || "Aucune alerte"} />
            <MetricCard label="Prochain objectif" value="Être prêt pour le devoir" hint="Plan court et régulier" />
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-950">Déclarer la progression de classe</h3>
            <form action="/api/app/topic" method="post" className="mt-4 grid gap-4 md:grid-cols-3">
              <input type="hidden" name="studentId" value={student.id} />
              <div>
                <label className="label" htmlFor="areaSlug">SA</label>
                <select id="areaSlug" name="areaSlug" className="input">
                  <option value="sa1">SA1</option>
                  <option value="sa2">SA2</option>
                  <option value="sa3">SA3</option>
                  <option value="sa4">SA4</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="topicSlug">Notion</label>
              <input id="topicSlug" name="topicSlug" className="input" defaultValue={student.current_topic_slug} />
              </div>
              <div className="flex items-end">
                <button className="btn-primary w-full">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
        <div className="space-y-6">
          <div className="card">
            <p className="font-semibold text-slate-950">Profil enfant</p>
            <p className="mt-2 text-sm text-slate-600">{student.first_name} · {student.level} · {student.school || "Établissement non renseigné"}</p>
            <p className="mt-3 text-sm text-slate-700">Notion actuelle : <span className="font-semibold">{topicLabels[student.current_topic_slug]}</span></p>
          </div>
          <div className="card">
            <p className="font-semibold text-slate-950">États des SA</p>
            <div className="mt-4 space-y-3">
              {["sa1", "sa2", "sa3", "sa4"].map((sa, index) => (
                <div key={sa} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span>SA{index + 1}</span>
                  <Pill tone={index === 0 ? "amber" : "slate"}>{index === 0 ? "en cours" : "pas commencé"}</Pill>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
