import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getStudentSelectionForParent } from "@/lib/active-student";
import { getLearningJourneyState } from "@/lib/annual-program";
import { requireParentAccess } from "@/lib/auth";
import { topicLabels } from "@/lib/topics";

export default async function ElevePage() {
  const user = await requireParentAccess({ requireStudent: true });
  if (user.role !== "parent") redirect("/admin");
  const { activeStudent: student } = await getStudentSelectionForParent(user.id);
  if (!student) redirect("/app");
  const journey = await getLearningJourneyState(student.id);

  if (journey.phase === "annual_tracking") {
    const session = journey.annual.recommendedSession;
    return <AppShell title="Espace élève"><div className="mx-auto max-w-4xl space-y-6">
      <section className="card"><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Cette semaine</p><h2 className="mt-2 text-3xl font-bold text-slate-950">Que doit faire {student.first_name} ?</h2>
        {session ? <div className="mt-5 space-y-2 text-sm text-slate-700"><p className="text-lg font-bold text-slate-950">{session.topic_label}</p><p className="font-semibold text-slate-900">{session.title}</p>{session.week_number ? <p><span className="font-semibold">Référence pédagogique :</span> J{session.week_number}</p> : null}<p><span className="font-semibold">Guide :</span> {session.guide_reference ?? "Référence du guide en cours de préparation"}</p>{session.page_reference ? <p><span className="font-semibold">Pages :</span> {session.page_reference}</p> : null}<p><span className="font-semibold">Durée :</span> {session.estimated_minutes ? `${session.estimated_minutes} min` : `${student.target_minutes ?? 35} min`}</p><div className="rounded-2xl bg-slate-50 p-4"><p className="font-semibold text-slate-950">Pourquoi cette séance ?</p><p className="mt-2">{session.reason}</p></div></div> : <p className="mt-5 rounded-2xl bg-blue-50 p-5 text-sm leading-6 text-slate-700">Le suivi annuel est activé. Le contenu de votre première semaine sera disponible dès sa publication.</p>}
      </section>
      {session?.lesson_ai ? <section className="card border-blue-200 bg-blue-50"><h3 className="text-lg font-bold">Leçon IA - {session.lesson_ai.duration_minutes} min</h3><p className="mt-3 font-semibold text-slate-900">{session.lesson_ai.title}</p><p className="mt-2 text-sm leading-6 text-slate-700">{session.lesson_ai.explanation}</p>{session.lesson_ai.examples.length ? <div className="mt-3 space-y-1 text-sm text-slate-700">{session.lesson_ai.examples.map((example) => <p key={example}>- {example}</p>)}</div> : null}</section> : null}
      {session ? <section className="card"><h3 className="text-lg font-bold">Dans le guide</h3><div className="mt-4 space-y-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="font-semibold">{session.guide_reference ?? "Référence du guide en cours de préparation"}</p><p className="mt-2 text-sm text-slate-700">Prenez le guide, allez à la référence indiquée et laissez {student.first_name} travailler sur papier.</p>{session.page_reference ? <p className="mt-2 text-sm text-slate-700">Pages : {session.page_reference}</p> : null}<p className="mt-2 text-sm text-slate-700">{session.exercise_reference ? `Repère : ${session.exercise_reference}` : "Référence du guide en cours de préparation."}</p></div><div className="rounded-2xl bg-blue-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-950">Après le travail papier</p><p className="mt-2">Photographiez la copie puis revenez ici pour l’envoyer. ÉLAN vérifiera d’abord que la copie correspond bien au travail demandé.</p></div></div></section> : null}
      <div className="flex flex-wrap gap-3"><Link href="/app/envoyer-travail" className="btn-primary">Envoyer le travail</Link><Link href="/app/progression" className="btn-secondary">Voir la progression</Link></div>
    </div></AppShell>;
  }

  if (journey.preparation.requiresDiagnostic) {
    return <AppShell title="Espace élève"><div className="mx-auto max-w-4xl space-y-6">
      <section className="card">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Parcours diagnostic</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-950">Que doit faire {student.first_name} ?</h2>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
          <p>Le programme personnalisé n’apparaîtra qu’après l’analyse du diagnostic initial.</p>
          <p>1. Ouvrez le Guide 1 Diagnostic & Révision.</p>
          <p>2. Laissez {student.first_name} répondre aux 26 questions sur papier.</p>
          <p>3. Photographiez ensuite la copie pour l’envoyer dans l’application.</p>
        </div>
      </section>
      <section className="card">
        <h3 className="text-lg font-bold text-slate-950">Après le travail papier</h3>
        <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-slate-700">
          <p>ÉLAN vérifiera d’abord que la copie correspond bien au diagnostic, puis préparera le programme J1 à J14 selon les difficultés détectées.</p>
        </div>
      </section>
      <div className="flex flex-wrap gap-3"><Link href="/app/diagnostic" className="btn-primary">Commencer le diagnostic</Link></div>
    </div></AppShell>;
  }

  const day = journey.preparation.currentDay;
  const topicLabel = day?.topicSlugs?.[0] ? topicLabels[day.topicSlugs[0]] ?? day.topicSlugs[0] : null;
  const sessionLabel = day?.sessionIndex ?? 1;
  return <AppShell title="Espace élève"><div className="mx-auto max-w-4xl space-y-6">
    <section className="card"><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Aujourd’hui</p><h2 className="mt-2 text-3xl font-bold text-slate-950">Que doit faire {student.first_name} ?</h2>{day ? <div className="mt-4 space-y-3"><p className="text-lg font-bold text-slate-950">{topicLabel ?? (day.isFinalValidation ? "Bilan final" : day.title)}</p><p className="text-sm font-semibold text-slate-900">Séance {sessionLabel} sur {journey.preparation.totalDays} · {day.isFinalValidation ? "Validation finale" : day.title}</p><p className="text-sm text-slate-700"><span className="font-semibold">Guide :</span> {day.guideLabel}</p><p className="text-sm text-slate-700"><span className="font-semibold">Jour :</span> J{day.day_number}</p>{day.pageReference ? <p className="text-sm text-slate-700"><span className="font-semibold">Pages :</span> {day.pageReference}</p> : null}{day.recommendedPart !== "Guide papier" ? <p className="text-sm text-slate-700"><span className="font-semibold">Partie :</span> {day.recommendedPart}</p> : null}{day.recommendedLevel !== "Guide papier" ? <p className="text-sm text-slate-700"><span className="font-semibold">Niveau recommandé :</span> {day.recommendedLevel}</p> : null}<p className="text-sm text-slate-700"><span className="font-semibold">Durée :</span> {day.estimated_minutes_max ?? day.estimated_minutes_min ?? 20} min</p><div className="rounded-2xl bg-slate-50 p-4"><p className="font-semibold text-slate-950">Pourquoi cette séance ?</p><p className="mt-2 text-sm text-slate-700">{day.isFinalValidation ? "Cette séance valide la passerelle vers la 3e avant le suivi annuel." : day.objective}</p></div></div> : null}</section>
    {day?.lessonAi ? <section className="card border-blue-200 bg-blue-50"><h3 className="text-lg font-bold">Leçon IA - {day.lessonAi.duration_minutes} min</h3><p className="mt-3 font-semibold text-slate-900">{day.lessonAi.title}</p><p className="mt-2 text-sm leading-6 text-slate-700">{day.lessonAi.explanation}</p>{day.lessonAi.examples.length ? <div className="mt-3 space-y-1 text-sm text-slate-700">{day.lessonAi.examples.map((example) => <p key={example}>- {example}</p>)}</div> : null}</section> : null}
    {day ? <section className="card"><h3 className="text-lg font-bold">Dans le guide</h3><div className="mt-4 space-y-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="font-semibold">{day.guideLabel}</p><p className="mt-2 text-sm text-slate-700">Prenez le guide, ouvrez le Jour {day.day_number}{day.pageReference ? `, ${day.pageReference}` : ""}, puis laissez {student.first_name} travailler sur papier.</p>{day.recommendedPart !== "Guide papier" ? <p className="mt-2 text-sm text-slate-700">Commencez par <span className="font-semibold">{day.recommendedPart}</span>{day.recommendedLevel !== "Guide papier" ? ` puis ${day.recommendedLevel}` : ""}.</p> : null}</div><div className="rounded-2xl bg-blue-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-950">Après le travail papier</p><p className="mt-2">Photographiez le travail réalisé puis revenez dans l’application pour l’envoyer. ÉLAN vérifiera d’abord que la copie correspond à la bonne séance.</p></div></div></section> : null}
    <div className="flex flex-wrap gap-3"><Link href="/app/envoyer-travail" className="btn-primary">Envoyer le travail</Link><Link href="/app/progression" className="btn-secondary">Voir la progression</Link></div>
  </div></AppShell>;
}
