import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getStudentSelectionForParent } from "@/lib/active-student";
import {
  getDiagnosticAnalysisBySubmissionId,
  getDiagnosticSubmissionStatus,
  getLatestCompletedDiagnosticSubmissionForStudent,
  getLatestDiagnosticAnalysisForStudent,
} from "@/lib/app-data";
import { requireParentAccess } from "@/lib/auth";
import { getPretProgramState } from "@/lib/pret-program";
import { topicLabels } from "@/lib/topics";

type TopicResult = {
  topic_slug: string;
  mastery: "maitrise" | "a_renforcer" | "a_reprendre";
  reason?: string;
  confidence?: "high" | "medium" | "low";
  lesson_ai?: {
    title?: string;
    explanation?: string;
    duration_minutes?: number;
  } | null;
  guide_route?: {
    day_number?: number;
    guide_title?: string;
    page_reference?: string;
  } | null;
  follow_up_questions?: Array<{ question: string }>;
};

function compactMasteryMessage() {
  return "Cette notion est maîtrisée. Aucun travail prioritaire nécessaire pour le moment.";
}

function priorityOrder(value: TopicResult["mastery"]) {
  if (value === "a_reprendre") return 0;
  if (value === "a_renforcer") return 1;
  return 2;
}

function masteryLabel(value: TopicResult["mastery"]) {
  if (value === "a_reprendre") return "À reprendre";
  if (value === "a_renforcer") return "À renforcer";
  return "Maîtrisé";
}

function masteryTone(value: TopicResult["mastery"]) {
  if (value === "a_reprendre") return "border-red-200 bg-red-50";
  if (value === "a_renforcer") return "border-amber-200 bg-amber-50";
  return "border-green-200 bg-green-50";
}

export default async function DiagnosticResultPage({
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

  let submissionId = requestedSubmissionId;
  if (!submissionId) {
    submissionId = (await getLatestCompletedDiagnosticSubmissionForStudent(student.id))?.id ?? "";
  }
  if (!submissionId) redirect("/app/diagnostic");

  const submissionStatus = await getDiagnosticSubmissionStatus(submissionId);
  if (!submissionStatus) redirect("/app/diagnostic");
  if (submissionStatus.processing_status !== "completed") {
    redirect(`/app/diagnostic/analyse?submission=${submissionId}`);
  }

  const analysis = await getDiagnosticAnalysisBySubmissionId(submissionId) ?? await getLatestDiagnosticAnalysisForStudent(student.id);
  if (!analysis) redirect("/app/diagnostic");

  const preparation = await getPretProgramState(student.id);
  const topicResults = (Array.isArray(analysis.topic_results) ? analysis.topic_results : []) as TopicResult[];
  const sortedTopicResults = [...topicResults].sort((a, b) => priorityOrder(a.mastery) - priorityOrder(b.mastery));
  const absolutePriorities = sortedTopicResults.filter((item) => item.mastery === "a_reprendre");
  const consolidationTopics = sortedTopicResults.filter((item) => item.mastery === "a_renforcer");
  const masteredTopics = sortedTopicResults.filter((item) => item.mastery === "maitrise");
  const maitriseCount = sortedTopicResults.filter((item) => item.mastery === "maitrise").length;
  const renforceCount = sortedTopicResults.filter((item) => item.mastery === "a_renforcer").length;
  const reprendreCount = sortedTopicResults.filter((item) => item.mastery === "a_reprendre").length;

  return (
    <AppShell title="Résultat du diagnostic">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="card">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Diagnostic terminé</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-950">Bilan initial de {student.first_name}</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-800">Notions maîtrisées</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{maitriseCount}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">À renforcer</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{renforceCount}</p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">À reprendre</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">{reprendreCount}</p>
            </div>
          </div>
          <div className="mt-5 space-y-1 text-lg font-semibold text-slate-900">
            <p>{maitriseCount} maîtrisées</p>
            <p>{renforceCount} à renforcer</p>
            <p>{reprendreCount} à reprendre</p>
          </div>
        </section>

        <section className="card border-blue-200 bg-blue-50">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Résumé ÉLAN IA</p>
          <p className="mt-3 text-sm leading-7 text-slate-800">{analysis.summary_ai ?? "Le résumé IA sera disponible avec le résultat structuré."}</p>
        </section>

        <section className="card">
          <h3 className="text-xl font-bold text-slate-950">Priorités absolues</h3>
          <div className="mt-4 grid gap-4">
            {absolutePriorities.map((item) => (
              <article key={item.topic_slug} className={`rounded-2xl border p-4 ${masteryTone(item.mastery)}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-950">{topicLabels[item.topic_slug] ?? item.topic_slug}</p>
                    <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-slate-700">{masteryLabel(item.mastery)}</p>
                  </div>
                  <p className="text-sm text-slate-700">Confiance IA : {item.confidence ?? "low"}</p>
                </div>
                {item.reason ? <p className="mt-3 text-sm leading-6 text-slate-700">{item.reason}</p> : null}
                {item.lesson_ai ? (
                  <div className="mt-4 rounded-2xl bg-white/80 p-4">
                    <p className="font-semibold text-slate-950">Leçon IA — {item.lesson_ai.duration_minutes ?? 5} min</p>
                    {item.lesson_ai.title ? <p className="mt-2 text-sm font-semibold text-slate-900">{item.lesson_ai.title}</p> : null}
                    {item.lesson_ai.explanation ? <p className="mt-2 text-sm leading-6 text-slate-700">{item.lesson_ai.explanation}</p> : null}
                  </div>
                ) : null}
                {item.guide_route ? (
                  <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-slate-800">
                    <p className="font-semibold text-slate-950">{item.guide_route.guide_title ?? "Guide 1 - Diagnostic & Révision"}</p>
                    <p className="mt-1">Référence pédagogique J{item.guide_route.day_number ?? "?"}</p>
                    {item.guide_route.page_reference ? <p>{item.guide_route.page_reference}</p> : null}
                  </div>
                ) : null}
                {item.mastery === "a_reprendre" && item.follow_up_questions?.length ? (
                  <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-slate-800">
                    <p className="font-semibold text-slate-950">Questions ciblées possibles</p>
                    <div className="mt-2 space-y-1">
                      {item.follow_up_questions.map((question, index) => <p key={`${item.topic_slug}-${index}`}>- {question.question}</p>)}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <h3 className="text-xl font-bold text-slate-950">À consolider</h3>
          <div className="mt-4 grid gap-4">
            {consolidationTopics.map((item) => (
              <article key={item.topic_slug} className={`rounded-2xl border p-4 ${masteryTone(item.mastery)}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-950">{topicLabels[item.topic_slug] ?? item.topic_slug}</p>
                    <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-slate-700">{masteryLabel(item.mastery)}</p>
                  </div>
                  <p className="text-sm text-slate-700">Confiance IA : {item.confidence ?? "low"}</p>
                </div>
                {item.reason ? <p className="mt-3 text-sm leading-6 text-slate-700">{item.reason}</p> : null}
                {item.lesson_ai ? (
                  <div className="mt-4 rounded-2xl bg-white/80 p-4">
                    <p className="font-semibold text-slate-950">Leçon IA — {item.lesson_ai.duration_minutes ?? 5} min</p>
                    {item.lesson_ai.title ? <p className="mt-2 text-sm font-semibold text-slate-900">{item.lesson_ai.title}</p> : null}
                    {item.lesson_ai.explanation ? <p className="mt-2 text-sm leading-6 text-slate-700">{item.lesson_ai.explanation}</p> : null}
                  </div>
                ) : null}
                {item.guide_route ? (
                  <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-slate-800">
                    <p className="font-semibold text-slate-950">{item.guide_route.guide_title ?? "Guide 1 - Diagnostic & Révision"}</p>
                    <p className="mt-1">Référence pédagogique J{item.guide_route.day_number ?? "?"}</p>
                    {item.guide_route.page_reference ? <p>{item.guide_route.page_reference}</p> : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <h3 className="text-xl font-bold text-slate-950">Acquis validés</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {masteredTopics.map((item) => (
              <article key={item.topic_slug} className="rounded-2xl border border-green-200 bg-green-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-base font-bold text-slate-950">{topicLabels[item.topic_slug] ?? item.topic_slug}</p>
                  <p className="text-sm font-semibold uppercase tracking-wide text-green-800">{masteryLabel(item.mastery)}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{compactMasteryMessage()}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-950">Programme personnalisé</h3>
              <p className="mt-2 text-base font-semibold text-slate-900">{preparation.totalDays} séances recommandées · jusqu&apos;à 14 jours</p>
              <p className="mt-2 text-sm text-slate-600">Le plan est figé à partir du diagnostic validé et conserve la même séquence après refresh ou reconnexion.</p>
            </div>
            {preparation.enrolled ? (
              <Link href="/app/eleve" className="btn-primary">Continuer le programme</Link>
            ) : (
              <form action="/api/app/start-program" method="post">
                <input type="hidden" name="studentId" value={student.id} />
                <button className="btn-primary">Commencer le programme</button>
              </form>
            )}
          </div>
          <div className="mt-5 grid gap-4">
            {preparation.days.map((day, index) => (
              <article key={day.id} className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                  Séance {day.sessionIndex ?? index + 1} sur {preparation.totalDays}
                </p>
                <h4 className="mt-2 text-xl font-bold text-slate-950">{day.isFinalValidation ? "Bilan final" : day.title}</h4>
                <div className="mt-3 space-y-1 text-sm text-slate-700">
                  <p><span className="font-semibold">Référence guide :</span> J{day.day_number}</p>
                  <p><span className="font-semibold">Guide :</span> {day.guideLabel}</p>
                  {day.pageReference ? <p><span className="font-semibold">Pages :</span> {day.pageReference}</p> : null}
                  {day.recommendedPart !== "Guide papier" ? <p><span className="font-semibold">Partie :</span> {day.recommendedPart}</p> : null}
                  {day.recommendedLevel !== "Guide papier" ? <p><span className="font-semibold">Niveau :</span> {day.recommendedLevel}</p> : null}
                  <p><span className="font-semibold">Durée :</span> {day.estimated_minutes_max ?? day.estimated_minutes_min ?? 20} min</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
