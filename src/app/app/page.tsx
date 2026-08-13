import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MetricCard, Pill } from "@/components/cards";
import { listStudentsForParent } from "@/lib/app-data";
import { requireUser } from "@/lib/auth";
import { getPretProgramState } from "@/lib/pret-program";

export default async function ParentDashboardPage() {
  const user = await requireUser();
  if (user.role !== "parent") redirect("/admin");
  const student = (await listStudentsForParent(user.id))[0];
  if (!student) redirect("/inscription");

  const program = await getPretProgramState(student.id);
  const currentDay = program.currentDay;
  const latestScore = program.latestAnalysis ? `${program.latestAnalysis.score}/20` : "—";
  const latestHint = program.latestAnalysis?.conseil_parent ?? "Aucune analyse corrigée pour le moment.";
  const reviewLabel = program.reviewTopics.slice(0, 3).join(", ") || "Aucune alerte pour l’instant";
  const duration = currentDay
    ? `${currentDay.estimated_minutes_min ?? 30} à ${currentDay.estimated_minutes_max ?? 45} min`
    : "30 à 45 min";

  return (
    <AppShell title={`Bonjour ${user.fullName}`}>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="card">
            <p className="text-sm text-slate-500">Programme du moment</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950">{program.programTitle}</h2>
            {program.available && currentDay ? (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Jour {currentDay.day_number} sur {program.totalDays} · {currentDay.title} · {duration}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{currentDay.objective ?? "Objectif disponible dans le guide."}</p>
                <p className="mt-2 text-sm text-slate-600">
                  Références guide : {currentDay.guideReferences.join(" · ") || "À afficher après chargement du guide"}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Le dashboard est prêt pour le guide 14 jours. Exécute la migration Supabase du guide pour afficher ici le vrai jour courant.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              {program.available ? (
                program.enrolled ? (
                  <Link href="/app/eleve" className="btn-primary">Commencer le travail</Link>
                ) : (
                  <form action="/api/app/start-program" method="post">
                    <input type="hidden" name="studentId" value={student.id} />
                    <button className="btn-primary">Démarrer les 14 jours</button>
                  </form>
                )
              ) : (
                <Link href="/app/progression" className="btn-primary">Voir l’état du guide</Link>
              )}
              <Pill tone={program.enrolled ? "green" : "amber"}>{program.enrolled ? "programme lancé" : "à démarrer"}</Pill>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Progression" value={`${program.progressPercent} %`} hint={`${program.completedDays}/${program.totalDays} jours terminés`} />
            <MetricCard label="Dernier résultat" value={latestScore} hint={latestHint} />
            <MetricCard label="Points à revoir" value={reviewLabel} />
            <MetricCard
              label="Dernier travail"
              value={program.latestSubmission ? "Envoyé" : "Aucun"}
              hint={program.latestSubmission ? new Date(program.latestSubmission.created_at).toLocaleString("fr-FR") : "Envoyez une première copie pour lancer le suivi."}
            />
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-slate-950">Prochaine séance</h3>
            {currentDay ? (
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <p><span className="font-semibold">Jour {currentDay.day_number}</span> · {currentDay.title}</p>
                <p>{currentDay.objective}</p>
                <p>Items à traiter : {currentDay.actionableItems}</p>
                <p>Items déjà validés : {currentDay.completedItems}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">Le prochain jour sera affiché ici dès que le programme sera démarré.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <p className="font-semibold text-slate-950">Profil enfant</p>
            <p className="mt-2 text-sm text-slate-600">{student.first_name} · {student.level} · {student.school || "Établissement non renseigné"}</p>
            <p className="mt-3 text-sm text-slate-700">Produit actuel : <span className="font-semibold">PRÊT POUR LA 3e EN 14 JOURS</span></p>
          </div>

          <div className="card">
            <p className="font-semibold text-slate-950">Aperçu des jours</p>
            <div className="mt-4 space-y-3">
              {(program.days.length ? program.days.slice(0, 6) : Array.from({ length: 6 }, (_, index) => ({ day_number: index + 1, status: "not_started" as const }))).map((day) => {
                const tone = day.status === "completed" ? "green" : day.status === "in_progress" ? "amber" : day.status === "needs_review" ? "blue" : "slate";
                const label = day.status === "completed" ? "terminé" : day.status === "in_progress" ? "en cours" : day.status === "needs_review" ? "à revoir" : "à venir";
                return (
                  <div key={day.day_number} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <span>Jour {day.day_number}</span>
                    <Pill tone={tone}>{label}</Pill>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
