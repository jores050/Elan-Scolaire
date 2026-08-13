import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MetricCard, Pill } from "@/components/cards";
import { listStudentsForParent } from "@/lib/app-data";
import { requireUser } from "@/lib/auth";
import { getPretProgramState } from "@/lib/pret-program";

export default async function ProgressionPage() {
  const user = await requireUser();
  if (user.role !== "parent") redirect("/admin");
  const student = (await listStudentsForParent(user.id))[0];
  if (!student) redirect("/app");

  const program = await getPretProgramState(student.id);

  return (
    <AppShell title="Progression 14 jours">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Programme" value={program.available ? "1" : "0"} />
        <MetricCard label="Jours terminés" value={`${program.completedDays}/${program.totalDays}`} />
        <MetricCard label="Progression" value={`${program.progressPercent} %`} />
        <MetricCard label="Notions à revoir" value={String(program.reviewTopics.length)} />
      </div>

      <div className="card mt-6">
        <h2 className="text-lg font-semibold text-slate-950">Les 14 jours</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(program.days.length ? program.days : Array.from({ length: 14 }, (_, index) => ({
            id: String(index + 1),
            day_number: index + 1,
            title: `Jour ${index + 1}`,
            status: "not_started" as const,
            completedItems: 0,
            actionableItems: 0,
          }))).map((day) => {
            const tone = day.status === "completed" ? "green" : day.status === "in_progress" ? "amber" : day.status === "needs_review" ? "blue" : "slate";
            return (
              <div key={day.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">Jour {day.day_number}</p>
                    <p className="text-sm text-slate-600">{day.title}</p>
                  </div>
                  <Pill tone={tone}>
                    {day.status === "completed" ? "completed" : day.status === "in_progress" ? "in_progress" : day.status === "needs_review" ? "needs_review" : "not_started"}
                  </Pill>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {day.completedItems}/{day.actionableItems} item(s) validé(s)
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="text-lg font-semibold text-slate-950">Notions à revoir</h2>
        {program.reviewTopics.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Aucune notion remontée par les analyses pour le moment.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {program.reviewTopics.map((topic: string) => <li key={topic}>- {topic}</li>)}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
