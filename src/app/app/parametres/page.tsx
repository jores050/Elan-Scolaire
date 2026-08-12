import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getLicenseById, listStudentsForParent } from "@/lib/app-data";

export default async function ParametresPage() {
  const user = await requireUser();
  if (user.role !== "parent") redirect("/admin");
  const student = (await listStudentsForParent(user.id))[0];
  if (!student) redirect("/app");
  const license = await getLicenseById(user.activeLicenseId);
  return (
    <AppShell title="Paramètres">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-950">Parent</h2>
          <p className="mt-3 text-sm text-slate-700">{user.fullName}</p>
          <p className="text-sm text-slate-600">{user.email}</p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-950">Licence</h2>
          <p className="mt-3 text-sm text-slate-700">Pack Maths 3e — Actif</p>
          <p className="text-sm text-slate-600">Clé terminant par •••• {license?.key_suffix ?? "----"}</p>
        </div>
        <div className="card md:col-span-2">
          <h2 className="text-lg font-semibold text-slate-950">Routine</h2>
          <form action="/api/app/settings" method="post" className="mt-4 grid gap-4 md:grid-cols-3">
            <input type="hidden" name="studentId" value={student.id} />
            <div>
              <label className="label" htmlFor="targetMinutes">Durée cible</label>
              <input id="targetMinutes" name="targetMinutes" className="input" type="number" defaultValue={student.target_minutes} />
            </div>
            <div>
              <label className="label" htmlFor="studyDays">Jours de travail</label>
              <input id="studyDays" name="studyDays" className="input" defaultValue={(student.study_days ?? []).join(",")} />
            </div>
            <div className="flex items-end">
              <button className="btn-primary w-full">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
