import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/cards";
import { requireUser } from "@/lib/auth";
import { listStudentsForParent, listSubmissionsWithAnalyses } from "@/lib/app-data";
import { topicLabels } from "@/lib/topics";

export default async function TravauxPage() {
  const user = await requireUser();
  if (user.role !== "parent") redirect("/admin");
  const student = (await listStudentsForParent(user.id))[0];
  if (!student) redirect("/app");
  const submissions = await listSubmissionsWithAnalyses(student.id);

  return (
    <AppShell title="Historique des travaux">
      <div className="card">
        <div className="grid gap-4">
          {submissions.map((submission) => {
            const analysis = submission.ai_analyses?.[0];
            return (
            <div key={submission.id} className="rounded-3xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{topicLabels[student.current_topic_slug]}</p>
                  <p className="text-sm text-slate-500">{new Date(submission.created_at).toLocaleString("fr-FR")}</p>
                </div>
                <Pill tone={analysis?.status === "reussi" ? "green" : analysis?.status === "partiel" ? "amber" : "slate"}>
                  {analysis ? `${analysis.score}/20` : "Analyse en cours"}
                </Pill>
              </div>
              <p className="mt-3 text-sm text-slate-600">{analysis?.conseil_eleve ?? "Analyse en cours..."}</p>
            </div>
          )})}
        </div>
      </div>
    </AppShell>
  );
}
