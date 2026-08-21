import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MetricCard, Pill } from "@/components/cards";
import { getStudentSelectionForParent } from "@/lib/active-student";
import { getLearningJourneyState } from "@/lib/annual-program";
import { requireParentAccess } from "@/lib/auth";
import { getProgressStatusLabel } from "@/lib/progress-status";
import { topicLabels } from "@/lib/topics";

export default async function ProgressionPage() {
  const user = await requireParentAccess({ requireStudent: true });
  if (user.role !== "parent") redirect("/admin");
  const { activeStudent: student } = await getStudentSelectionForParent(user.id);
  if (!student) redirect("/app");
  const { preparation, annual } = await getLearningJourneyState(student.id);
  const reviewTopicLabels = (preparation.reviewTopics.length ? preparation.reviewTopics : annual.reviewTopics).map((topic: string) => topicLabels[topic] ?? topic);

  if (preparation.requiresDiagnostic) {
    return <AppShell title="Progression">
      <section className="card">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Diagnostic requis</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Le programme personnalisé n’est pas encore disponible</h2>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
          <p>Les séances J1 à J14 seront générées uniquement après l’analyse complète du diagnostic papier.</p>
          <p>Commencez par faire le Guide 1 sur papier, puis envoyez les photos dans l’application.</p>
        </div>
      </section>
    </AppShell>;
  }

  return <AppShell title="Progression">
    <section className="card">
      <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Préparation 14 jours</p>
      <h2 className="mt-2 text-2xl font-bold text-slate-950">{preparation.completedDays === preparation.totalDays ? "Préparation terminée" : `${preparation.completedDays}/${preparation.totalDays} séances terminées`}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{preparation.days.map((day, index) => <div key={day.id} className="rounded-2xl border border-slate-200 p-3 text-sm"><div className="flex justify-between gap-2"><span className="font-semibold">Séance {day.sessionIndex ?? index + 1}</span><Pill tone={day.status === "completed" ? "green" : day.status === "needs_review" ? "amber" : "slate"}>{getProgressStatusLabel(day.status)}</Pill></div><p className="mt-2 text-slate-600">{day.isFinalValidation ? "Bilan final" : day.title}</p><p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Guide J{day.day_number}</p></div>)}</div>
    </section>

    <section className="card mt-6">
      <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Année de 3e</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Semaine actuelle" value={annual.currentWeek ? String(annual.currentWeek.week_number) : "—"} />
        <MetricCard label="Semaines terminées" value={String(annual.completedWeeks)} />
        <MetricCard label="Points à revoir" value={String(reviewTopicLabels.length)} />
        <MetricCard label="Dernière analyse" value={annual.latestAnalysis?.score != null ? `${annual.latestAnalysis.score}/20` : "—"} />
      </div>
      {annual.recommendedSession ? <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-950">Séance du moment</p><p className="mt-2">{annual.recommendedSession.topic_label} · {annual.recommendedSession.title}</p><p className="mt-1">{annual.recommendedSession.reference_label}</p><p className="mt-1">{annual.recommendedSession.reason}</p></div> : null}
      {annual.weeks.length ? <div className="mt-6 grid gap-3 md:grid-cols-2">{annual.weeks.map((week) => <div key={week.id} className="rounded-2xl border border-slate-200 p-4"><p className="font-bold">Semaine {week.week_number} · {week.title}</p><p className="mt-2 text-sm text-slate-600">{week.completedItems}/{week.items.length} item(s) terminés</p></div>)}</div> : <p className="mt-6 rounded-2xl bg-blue-50 p-5 text-sm text-slate-700">Le suivi de l’année est activé. Le programme de votre enfant apparaîtra ici dès que sa première semaine sera disponible.</p>}
    </section>

    <section className="card mt-6"><h2 className="text-xl font-bold text-slate-950">À revoir avec votre enfant</h2>{reviewTopicLabels.length ? <ul className="mt-4 space-y-2 text-sm text-slate-700">{reviewTopicLabels.map((topic: string) => <li key={topic}>• {topic}</li>)}</ul> : <p className="mt-3 text-sm text-slate-600">Aucun point réel à revoir pour le moment.</p>}</section>
  </AppShell>;
}
