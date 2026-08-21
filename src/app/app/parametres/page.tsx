import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getStudentSelectionForParent } from "@/lib/active-student";
import { requireParentAccess } from "@/lib/auth";
import { getLicenseById, getReminderPreference } from "@/lib/app-data";
import { getReminderTimezone, getWeekdayLabel } from "@/lib/reminders";
import { topicLabels } from "@/lib/topics";

export default async function ParametresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireParentAccess({ requireStudent: true });
  if (user.role !== "parent") redirect("/admin");
  const { activeStudent: student } = await getStudentSelectionForParent(user.id);
  if (!student) redirect("/app");
  const [license, reminder] = await Promise.all([
    getLicenseById(user.activeLicenseId),
    getReminderPreference(student.id),
  ]);
  const reminderDays = Array.isArray(reminder?.days) ? reminder.days.map(Number) : [1, 3, 6];
  const reminderHour = typeof reminder?.hour === "string" ? reminder.hour : "18:30";
  const reminderActive = reminder?.active !== false;
  const saved = params.saved === "1";
  const error = params.error === "forbidden";

  return (
    <AppShell title="Paramètres">
      <div className="grid gap-6 md:grid-cols-2">
        {saved ? <div className="card md:col-span-2 border-green-200 bg-green-50 text-sm text-green-900">Les paramètres de {student.first_name} ont été enregistrés.</div> : null}
        {error ? <div className="card md:col-span-2 border-red-200 bg-red-50 text-sm text-red-900">Impossible d’enregistrer ces paramètres avec le compte actuel.</div> : null}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-950">Parent</h2>
          <p className="mt-3 text-sm text-slate-700">{user.fullName}</p>
          <p className="text-sm text-slate-600">{user.email}</p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-950">Licence</h2>
          <p className="mt-3 text-sm text-slate-700">Pack Maths 3e — Actif</p>
          <p className="text-sm text-slate-600">Clé terminant par •••• {license?.key_suffix ?? "----"}</p>
          {user.licenseExpiringSoon ? (
            <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Renouvellement à prévoir sous {user.licenseDaysRemaining ?? "peu"} jour(s). Les données restent conservées.
            </p>
          ) : null}
        </div>
        <div className="card md:col-span-2">
          <h2 className="text-lg font-semibold text-slate-950">Chapitre actuel en classe</h2>
          <form action="/api/app/topic" method="post" className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
            <input type="hidden" name="studentId" value={student.id} />
            <input type="hidden" name="areaSlug" value={student.current_area_slug} />
            <div>
              <label className="label" htmlFor="topicSlug">En classe, ils travaillent actuellement :</label>
              <select id="topicSlug" name="topicSlug" className="input" defaultValue={student.current_topic_slug}>
                {Object.entries(topicLabels).map(([slug, label]) => (
                  <option key={slug} value={slug}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button className="btn-secondary w-full">Mettre à jour</button>
            </div>
          </form>
        </div>
        <div className="card md:col-span-2">
          <h2 className="text-lg font-semibold text-slate-950">Routine</h2>
          <form action="/api/app/settings" method="post" className="mt-4 grid gap-6 md:grid-cols-2">
            <input type="hidden" name="studentId" value={student.id} />
            <div>
              <label className="label" htmlFor="targetMinutes">Durée cible</label>
              <input id="targetMinutes" name="targetMinutes" className="input" type="number" defaultValue={student.target_minutes} />
            </div>
            <div>
              <label className="label" htmlFor="studyDays">Jours de travail</label>
              <input id="studyDays" name="studyDays" className="input" defaultValue={(student.study_days ?? []).join(",")} />
              <p className="mt-2 text-xs text-slate-500">Format simple : 1,3,6 pour lundi, mercredi, samedi.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 p-4 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-950">Rappels automatiques</h3>
                 <p className="mt-1 text-sm text-slate-600">
  Rappel automatique quotidien à 16 h, avec notifications in-app persistées en fuseau {getReminderTimezone()}.
</p>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" name="reminderActive" defaultChecked={reminderActive} />
                  Activer
                </label>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
                <div>
                  <p className="label">Jours de rappel</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                      <label key={day} className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                        <input type="checkbox" name="reminderDays" value={day} defaultChecked={reminderDays.includes(day)} />
                        {getWeekdayLabel(day)}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="reminderHour">Heure</label>
                  <input id="reminderHour" name="reminderHour" className="input" type="time" defaultValue={reminderHour} />
                </div>
              </div>
            </div>
            <div className="flex items-end md:col-span-2">
              <button className="btn-primary w-full">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
