import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/cards";
import { getStudentSelectionForParent } from "@/lib/active-student";
import { requireParentAccess } from "@/lib/auth";
import { listSubmissionsWithAnalyses } from "@/lib/app-data";
import { repairMojibake } from "@/lib/text";

export default async function TravauxPage() {
  const user = await requireParentAccess({ requireStudent: true });
  if (user.role !== "parent") redirect("/admin");
  const { activeStudent: student } = await getStudentSelectionForParent(user.id);
  if (!student) redirect("/app");
  const submissions = await listSubmissionsWithAnalyses(student.id);

  return (
    <AppShell title="Historique des travaux">
      <div className="card">
        <div className="grid gap-4">
          {submissions.map((submission) => {
            const analysis = submission.ai_analyses?.[0];
            const topicResults = Array.isArray(analysis?.topic_results) ? analysis.topic_results : [];
            const firstTopicResult = topicResults[0] as {
              lesson_ai?: { title?: string; duration_minutes?: number; explanation?: string };
              guide_route?: { day_number?: number; page_reference?: string; primary_part?: string; primary_level?: string };
            } | undefined;
            const day = submission.learning_program_days;
            const item = submission.learning_program_items;
            const week = submission.annual_program_weeks;
            const annualItem = submission.annual_week_items;
            const workTitle = day
              ? `Jour ${day.day_number} · ${day.title}${item?.title ? ` · ${item.title}` : ""}`
              : week
                ? `Semaine ${week.week_number} · ${week.title}${annualItem?.title ? ` · ${annualItem.title}` : ""}`
                : "Travail de mathématiques";
            const validationStatus = typeof submission.validation_status === "string" ? submission.validation_status : null;
            const processingStatus = typeof submission.processing_status === "string" ? submission.processing_status : null;
            const validationReason = typeof submission.validation_reason === "string" ? submission.validation_reason : "";
            const processingError = typeof submission.processing_error === "string" ? submission.processing_error : "";
            const needsManualConfirmation = validationStatus === "PARTIAL_MATCH" && processingStatus === "failed" && !submission.validation_confirmed_at;
            const isValidationBlocked = (validationStatus === "MISMATCH" || validationStatus === "UNREADABLE") && processingStatus === "failed";
            const isValidationRetry = validationStatus == null && processingStatus === "failed" && !analysis;
            return (
            <div key={submission.id} className="rounded-3xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{workTitle}</p>
                  <p className="text-sm text-slate-500">{new Date(submission.created_at).toLocaleString("fr-FR")}</p>
                </div>
                <Pill tone={analysis?.status === "reussi" ? "green" : analysis?.status === "partiel" ? "amber" : needsManualConfirmation || isValidationBlocked ? "amber" : "slate"}>
                  {analysis
                    ? (analysis.score != null ? `${analysis.score}/20` : "Sans note fiable")
                    : needsManualConfirmation
                      ? "Confirmation requise"
                      : isValidationBlocked
                        ? validationStatus === "UNREADABLE" ? "Copie illisible" : "Mauvaise copie"
                        : isValidationRetry
                          ? "Vérification à relancer"
                          : "Analyse en cours"}
                </Pill>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {analysis?.conseil_eleve
                  ? repairMojibake(analysis.conseil_eleve)
                  : validationReason || processingError || "Analyse en cours..."}
              </p>
              {needsManualConfirmation ? (
                <div className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Validation manuelle requise</p>
                  <p className="mt-2">Cette copie semble correspondre partiellement au travail attendu. Si c’est bien la bonne copie, vous pouvez confirmer pour lancer l’analyse.</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link href={`/app/travaux/analyse?submission=${submission.id}`} className="btn-secondary">Suivre l’analyse</Link>
                  </div>
                  <form className="mt-3" action={`/api/app/submissions/${submission.id}/confirm-match`} method="post">
                    <button className="btn-primary" type="submit">Confirmer cette copie</button>
                  </form>
                </div>
              ) : null}
              {isValidationBlocked ? (
                <div className="mt-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800">
                  <p className="font-semibold">{validationStatus === "UNREADABLE" ? "Copie illisible" : "Soumission non cohérente"}</p>
                  <p className="mt-2">{validationReason || processingError || "Renvoyez une copie plus nette ou le bon travail."}</p>
                  <div className="mt-3">
                    <Link href={`/app/travaux/analyse?submission=${submission.id}`} className="btn-secondary">Voir le détail</Link>
                  </div>
                </div>
              ) : null}
              {!analysis && !needsManualConfirmation && !isValidationBlocked ? (
                <div className="mt-3">
                  <Link href={`/app/travaux/analyse?submission=${submission.id}`} className="btn-secondary">Suivre l’analyse</Link>
                </div>
              ) : null}
              {firstTopicResult?.lesson_ai ? <div className="mt-3 rounded-2xl bg-blue-50 p-4 text-sm text-slate-800">
                <p className="font-semibold">Leçon IA - {firstTopicResult.lesson_ai.duration_minutes ?? 5} min</p>
                <p className="mt-2 font-medium">{firstTopicResult.lesson_ai.title ?? "Leçon ciblée"}</p>
                <p className="mt-2">{firstTopicResult.lesson_ai.explanation ?? ""}</p>
              </div> : null}
              {firstTopicResult?.guide_route ? <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold">Retour au guide</p>
                <p className="mt-2">Jour {firstTopicResult.guide_route.day_number ?? "?"}</p>
                <p>{firstTopicResult.guide_route.page_reference ?? "Pages a confirmer"}</p>
                <p>Commence par : {firstTopicResult.guide_route.primary_part ?? "Guide papier"}</p>
                <p>Puis : {firstTopicResult.guide_route.primary_level ?? "Guide papier"}</p>
              </div> : null}
            </div>
          )})}
        </div>
      </div>
    </AppShell>
  );
}
