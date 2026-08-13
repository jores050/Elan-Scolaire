import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getLatestAnalysisForStudent, getProgressSummary, listStudentsForParent, listStudyPlans } from "@/lib/app-data";

export default async function BepcPage() {
  const user = await requireUser();
  if (user.role !== "parent") redirect("/admin");
  const student = (await listStudentsForParent(user.id))[0];
  if (!student) redirect("/app");

  const summary = await getProgressSummary(student.id);
  const latest = await getLatestAnalysisForStudent(student.id);
  const plans = await listStudyPlans(student.id);

  return (
    <AppShell title="Préparation BEPC">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500">Notions suivies</p>
          <p className="mt-2 text-3xl font-bold">{summary.trackedTopics}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Plans de révision</p>
          <p className="mt-2 text-3xl font-bold">{plans.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Dernier score</p>
          <p className="mt-2 text-lg font-bold">{latest ? `${latest.score}/20` : "Aucun résultat"}</p>
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="text-lg font-semibold text-slate-950">Lecture BEPC</h2>
        <p className="mt-3 text-sm text-slate-600">
          Les indicateurs ci-dessus reflètent maintenant uniquement les vraies données de l’élève.
          L’intégration d’une banque complète de sujets BEPC devra s’appuyer sur de vrais contenus source avant diffusion commerciale.
        </p>
        <p className="mt-3 text-sm text-slate-700">
          Points à renforcer : {summary.weak.slice(0, 3).join(", ") || "aucune alerte pour l’instant"}.
        </p>
      </div>
    </AppShell>
  );
}
