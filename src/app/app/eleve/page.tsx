import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getRecommendation, listStudentsForParent } from "@/lib/app-data";

export default async function ElevePage() {
  const user = await requireUser();
  if (user.role !== "parent") redirect("/admin");
  const student = (await listStudentsForParent(user.id))[0];
  if (!student) redirect("/app");

  const recommendation = await getRecommendation(student);
  const exerciseNumber = recommendation.exercises[0]?.exercise_number;
  const taskLabel = exerciseNumber ? `l'exercice ${exerciseNumber}` : "les exercices recommandés dans ton guide";

  return (
    <AppShell title="Espace élève">
      <div className="mx-auto max-w-2xl card">
        <p className="text-sm text-slate-500">Salut {student.first_name} 👋</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-950">Voici ton travail aujourd’hui</h2>
        <div className="mt-6 rounded-3xl bg-blue-50 p-5">
          <p className="text-sm text-slate-500">Notion</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{recommendation.topicLabel}</p>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Ouvre ton guide et fais {taskLabel}.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            {recommendation.lastAdvice ?? "Quand tu auras terminé, envoie ton travail pour recevoir un retour personnalisé."}
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/app/envoyer-travail" className="btn-primary">Envoyer mon travail</Link>
          <Link href="/app" className="btn-secondary">Retour au tableau de bord</Link>
        </div>
      </div>
    </AppShell>
  );
}
