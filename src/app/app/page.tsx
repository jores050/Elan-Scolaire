import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MetricCard, Pill } from "@/components/cards";
import { getStudentSelectionForParent } from "@/lib/active-student";
import { getLearningJourneyState } from "@/lib/annual-program";
import { requireParentAccess } from "@/lib/auth";
import { listNotifications } from "@/lib/app-data";
import { getProgressStatusLabel } from "@/lib/progress-status";
import { topicLabels } from "@/lib/topics";
import { getWeeklySummaryForStudent } from "@/lib/weekly-summary";

function formatAlertDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default async function ParentDashboardPage() {
  const user = await requireParentAccess({ requireStudent: true });
  if (user.role !== "parent") redirect("/admin");
  const { activeStudent: student } = await getStudentSelectionForParent(user.id);
  if (!student) redirect("/app/ajouter-eleve");
  const [journey, notifications, weeklySummary] = await Promise.all([
    getLearningJourneyState(student.id),
    listNotifications(user.id),
    getWeeklySummaryForStudent(student.id),
  ]);
  const { preparation, annual } = journey;
  const latestSubmission = annual.latestSubmission ?? preparation.latestSubmission;
  const reviewTopics = journey.phase === "annual_tracking" ? annual.reviewTopics : preparation.reviewTopics;
  const reviewTopicLabels = reviewTopics.map((topic: string) => topicLabels[topic] ?? topic);
  const alerts = notifications
    .filter((item) => !item.student_id || item.student_id === student.id)
    .slice(0, 4);

  if (journey.phase === "annual_tracking") {
    const session = annual.recommendedSession;
    return (
      <AppShell title={`Bonjour ${user.fullName}`}>
        <div className="space-y-6">
          <section className="card">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Aujourd’hui</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950">{student.first_name}</h2>
            {session ? (
              <div className="mt-5 space-y-2 text-sm text-slate-700">
                <p className="text-lg font-bold">{session.topic_label}</p>
                <p><span className="font-semibold">Séance :</span> {session.title}</p>
                {session.week_number ? <p><span className="font-semibold">Référence pédagogique :</span> J{session.week_number}</p> : null}
                <p><span className="font-semibold">Guide :</span> {session.guide_reference ?? "Référence du guide en cours de préparation"}</p>
                {session.page_reference ? <p><span className="font-semibold">Pages :</span> {session.page_reference}</p> : null}
                <p><span className="font-semibold">Exercices :</span> {session.exercise_reference ?? "Référence du guide en cours de préparation"}</p>
                <p><span className="font-semibold">Durée :</span> {session.estimated_minutes ? `${session.estimated_minutes} min` : `${student.target_minutes ?? 35} min`}</p>
                <p className="text-slate-600">{session.reason}</p>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-blue-50 p-5 text-sm leading-6 text-slate-700">
                <p className="font-bold text-slate-950">Aucune séance à faire aujourd’hui.</p>
                <p className="mt-1">Le suivi annuel est activé. ÉLAN affichera la prochaine séance dès qu’un contenu hebdomadaire sera disponible.</p>
              </div>
            )}
            {session?.lesson_ai ? <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-950">Leçon IA · {session.lesson_ai.duration_minutes} min</p><p className="mt-2">{session.lesson_ai.explanation}</p></div> : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/app/envoyer-travail" className="btn-primary">Scanner son travail</Link>
              <Link href="/app/eleve" className="btn-secondary">{session ? "Voir la séance" : "Voir le suivi de l’année"}</Link>
            </div>
          </section>
          <section className="card">
            <h2 className="text-xl font-bold text-slate-950">Cette semaine</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <MetricCard label="Séances prévues" value={`${weeklySummary.sessionsPlanned}`} />
              <MetricCard label="Séances réalisées" value={`${weeklySummary.sessionsCompleted}`} />
              <MetricCard label="Travaux scannés" value={`${weeklySummary.scannedWorks}`} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700">{weeklySummary.summaryText}</p>
          </section>
          <section className="card">
            <h2 className="text-xl font-bold text-slate-950">Prochaine étape</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">{annual.nextStepSummary}</p>
          </section>
          {alerts.length ? <section className="card">
            <h2 className="text-xl font-bold text-slate-950">Alertes</h2>
            <div className="mt-4 space-y-3">
              {alerts.map((alert) => <div key={alert.id} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-950">{alert.message}</p><p className="mt-1 text-xs text-slate-500">{formatAlertDate(alert.created_at)}</p></div>)}
            </div>
          </section> : null}
        </div>
      </AppShell>
    );
  }

  const day = preparation.currentDay;
  const mainTopic = day?.topicSlugs?.[0] ? topicLabels[day.topicSlugs[0]] ?? day.topicSlugs[0] : null;
  const sessionLabel = day?.sessionIndex ?? 1;
  const showPersonalizedProgram = !preparation.requiresDiagnostic;
  const diagnosticStatus = preparation.requiresDiagnostic
    ? latestSubmission?.submission_kind === "diagnostic"
      ? latestSubmission.processing_status
      : "missing"
    : null;
  return (
    <AppShell title={`Bonjour ${user.fullName}`}>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          {preparation.requiresDiagnostic ? (
            <section className="card border-blue-200 bg-blue-50">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Bienvenue dans ÉLAN</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-950">{student.first_name} est prêt à commencer.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {diagnosticStatus === "processing" || diagnosticStatus === "pending"
                  ? "Le diagnostic a bien été envoyé. ÉLAN analyse la copie et prépare les priorités de révision."
                  : diagnosticStatus === "failed"
                    ? "Le dernier essai n’a pas pu être analysé. Vérifiez que le scan est lisible puis relancez le diagnostic."
                    : "Première étape : faites le diagnostic papier dans le Guide 1 pour identifier précisément les acquis et les difficultés."}
              </p>
              {diagnosticStatus !== "processing" && diagnosticStatus !== "pending" ? (
                <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-950">Parcours conseillé</p>
                  <p className="mt-2">1. Ouvrir le Guide 1.</p>
                  <p>2. Laisser {student.first_name} répondre sur papier, sans l’aider.</p>
                  <p>3. Photographier les réponses et les envoyer dans l’application.</p>
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/app/diagnostic" className="btn-primary">
                  {diagnosticStatus === "failed" ? "Relancer le diagnostic" : diagnosticStatus === "processing" || diagnosticStatus === "pending" ? "Suivre l’analyse" : "Commencer le diagnostic"}
                </Link>
                <Pill tone="amber">
                  {diagnosticStatus === "failed" ? "diagnostic à relancer" : diagnosticStatus === "processing" || diagnosticStatus === "pending" ? "analyse en cours" : "diagnostic à faire"}
                </Pill>
              </div>
            </section>
          ) : null}
          <section className="card">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">{showPersonalizedProgram ? "Aujourd’hui" : "Parcours diagnostic"}</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950">{showPersonalizedProgram ? mainTopic ?? preparation.programTitle : "Diagnostic initial du Guide 1"}</h2>
            {showPersonalizedProgram ? (
              day ? <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                <p className="font-semibold text-slate-950">Séance {sessionLabel} sur {preparation.totalDays} · {day.isFinalValidation ? "Bilan final" : day.title}</p>
                <p><span className="font-semibold">Guide :</span> {day.guideLabel}</p>
                <p><span className="font-semibold">Jour :</span> J{day.day_number}</p>
                {day.pageReference ? <p><span className="font-semibold">Pages :</span> {day.pageReference}</p> : null}
                {day.recommendedPart !== "Guide papier" ? <p><span className="font-semibold">Partie :</span> {day.recommendedPart}</p> : null}
                {day.recommendedLevel !== "Guide papier" ? <p><span className="font-semibold">Niveau recommandé :</span> {day.recommendedLevel}</p> : null}
                <p><span className="font-semibold">Durée :</span> {day.estimated_minutes_max ?? day.estimated_minutes_min ?? 20} min</p>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">Pourquoi cette séance ?</p>
                  <p className="mt-2">{day.isFinalValidation ? "Cette séance sert à valider les progrès réalisés avant le passage au suivi annuel." : day.objective}</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="font-semibold text-slate-950">Prochaine action</p>
                  <p className="mt-2">Prenez le guide, laissez {student.first_name} travailler sur papier, puis revenez scanner son travail dans l’application.</p>
                </div>
              </div> : <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-slate-700">Aucune séance n’est prête aujourd’hui. ÉLAN affichera ici la prochaine action utile dès que le programme sera disponible.</div>
            ) : (
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <p>Avant toute séance personnalisée, ÉLAN doit d’abord analyser le diagnostic papier.</p>
                <p>1. Ouvrir le Guide 1 et faire les 26 questions sur papier.</p>
                <p>2. Photographier ou scanner les réponses.</p>
                <p>3. Envoyer la copie dans l’application pour obtenir le résultat et le programme recommandé.</p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {showPersonalizedProgram && preparation.enrolled ? <Link href="/app/eleve" className="btn-primary">Commencer le travail</Link> : preparation.requiresDiagnostic ? (
                <Link href="/app/diagnostic" className="btn-primary">Commencer le diagnostic</Link>
              ) : (
                <Link href="/app/diagnostic/resultat" className="btn-primary">Voir le plan recommandé</Link>
              )}
              <Pill tone={preparation.enrolled ? "green" : "amber"}>{preparation.enrolled ? "programme lancé" : preparation.requiresDiagnostic ? "diagnostic requis" : "à démarrer"}</Pill>
            </div>
          </section>
          <section className="card">
            <h2 className="text-xl font-bold text-slate-950">Cette semaine</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <MetricCard label="Séances prévues" value={`${weeklySummary.sessionsPlanned}`} />
              <MetricCard label="Séances réalisées" value={`${weeklySummary.sessionsCompleted}`} />
              <MetricCard label="Travaux scannés" value={`${weeklySummary.scannedWorks}`} />
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <MetricCard label="Notions maîtrisées" value={`${weeklySummary.masteredCount}`} />
              <MetricCard label="À renforcer" value={`${weeklySummary.reinforceCount}`} />
              <MetricCard label="À reprendre" value={`${weeklySummary.revisitCount}`} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700">{weeklySummary.summaryText}</p>
          </section>
          <section className="card">
            <h2 className="text-xl font-bold text-slate-950">Prochaine étape</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {preparation.requiresDiagnostic
                ? diagnosticStatus === "processing" || diagnosticStatus === "pending"
                  ? "Attendre la fin de l’analyse du diagnostic, puis ouvrir le résultat pour lancer le programme."
                  : "Faire le diagnostic papier du Guide 1 puis envoyer le scan pour générer le programme personnalisé."
                : day
                  ? `Travailler la séance ${sessionLabel} dans le guide puis scanner le travail pour mettre la progression à jour.`
                  : "Ouvrir le plan recommandé pour voir la prochaine séance disponible."}
            </p>
          </section>
          {alerts.length ? <section className="card">
            <h2 className="text-xl font-bold text-slate-950">Alertes</h2>
            <div className="mt-4 space-y-3">
              {alerts.map((alert) => <div key={alert.id} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold text-slate-950">{alert.message}</p><p className="mt-1 text-xs text-slate-500">{formatAlertDate(alert.created_at)}</p></div>)}
            </div>
          </section> : null}
          {showPersonalizedProgram && day?.lessonAi ? <section className="card border-blue-200 bg-blue-50">
            <h3 className="font-bold text-slate-950">Leçon IA - {day.lessonAi.duration_minutes} min</h3>
            <p className="mt-2 font-semibold text-slate-900">{day.lessonAi.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{day.lessonAi.explanation}</p>
          </section> : null}
          <section className="card border-blue-200 bg-blue-50">
            <h3 className="font-bold text-slate-950">Et après les 14 jours ?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">Le suivi semaine par semaine prendra automatiquement le relais pour accompagner votre enfant pendant son année de 3e.</p>
          </section>
        </div>
        <aside className="space-y-6">
          <div className="card"><p className="font-semibold text-slate-950">Profil enfant</p><p className="mt-2 text-sm text-slate-600">{student.first_name} · {student.level} · {student.school || "Établissement non renseigné"}</p></div>
          {showPersonalizedProgram ? <div className="card"><p className="font-semibold text-slate-950">Aperçu des séances</p><div className="mt-4 space-y-3">{preparation.days.slice(0, 6).map((item, index) => <div key={item.id} className="flex justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm"><span>Séance {item.sessionIndex ?? index + 1} · J{item.day_number}</span><span>{getProgressStatusLabel(item.status)}</span></div>)}</div></div> : <div className="card"><p className="font-semibold text-slate-950">Avant le programme</p><p className="mt-3 text-sm leading-6 text-slate-600">Les séances J1 à J14 apparaîtront ici uniquement après l’analyse complète du diagnostic initial.</p></div>}
          {showPersonalizedProgram ? <div className="card"><p className="font-semibold text-slate-950">À consolider</p>{reviewTopicLabels.length ? <div className="mt-4 space-y-2">{reviewTopicLabels.slice(0, 4).map((topic: string) => <div key={topic} className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-slate-800">{topic}</div>)}</div> : <p className="mt-3 text-sm text-slate-600">Aucune difficulté réelle remontée pour le moment.</p>}</div> : null}
        </aside>
      </div>
    </AppShell>
  );
}
