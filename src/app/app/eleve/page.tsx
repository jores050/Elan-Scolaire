import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { listStudentsForParent } from "@/lib/app-data";
import { requireUser } from "@/lib/auth";
import { getPretProgramState } from "@/lib/pret-program";

export default async function ElevePage() {
  const user = await requireUser();
  if (user.role !== "parent") redirect("/admin");
  const student = (await listStudentsForParent(user.id))[0];
  if (!student) redirect("/app");

  const program = await getPretProgramState(student.id);
  const day = program.currentDay;
  const exercises = day?.items.filter((item) => item.item_type === "exercise") ?? [];
  const challenge = day?.items.find((item) => item.item_type === "challenge");
  const situation = day?.items.find((item) => item.item_type === "real_situation");

  return (
    <AppShell title="Espace élève">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="card">
          <p className="text-sm text-slate-500">Salut {student.first_name} 👋</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-950">Qu’est-ce que je dois faire aujourd’hui ?</h2>
          {program.available && day ? (
            <>
              <p className="mt-4 text-lg font-semibold text-slate-900">Jour {day.day_number} · {day.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{day.objective}</p>
              <p className="mt-2 text-sm text-slate-600">
                Durée prévue : {day.estimated_minutes_min ?? 30} à {day.estimated_minutes_max ?? 45} minutes
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              Le programme 14 jours n’est pas encore disponible côté base distante. Dès que la migration sera exécutée, le vrai travail du jour s’affichera ici.
            </p>
          )}
        </div>

        {day ? (
          <>
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-950">Exercices exacts du jour</h3>
              <div className="mt-4 space-y-3">
                {exercises.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">{item.title || `Exercice ${item.item_order}`}</p>
                    <p className="mt-2 text-sm text-slate-700">{item.prompt}</p>
                    <p className="mt-2 text-xs text-slate-500">Guide : {item.guide_reference}</p>
                  </div>
                ))}
              </div>
            </div>

            {challenge ? (
              <div className="card">
                <h3 className="text-lg font-semibold text-slate-950">Défi 3e</h3>
                <p className="mt-3 text-sm text-slate-700">{challenge.prompt}</p>
                <p className="mt-2 text-xs text-slate-500">Guide : {challenge.guide_reference}</p>
              </div>
            ) : null}

            {situation ? (
              <div className="card">
                <h3 className="text-lg font-semibold text-slate-950">Situation réelle</h3>
                <p className="mt-3 text-sm text-slate-700">{situation.prompt}</p>
                <p className="mt-2 text-xs text-slate-500">Guide : {situation.guide_reference}</p>
              </div>
            ) : null}
          </>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link href="/app/envoyer-travail" className="btn-primary">Envoyer mon travail</Link>
          <Link href="/app/progression" className="btn-secondary">J’ai terminé</Link>
        </div>
      </div>
    </AppShell>
  );
}
