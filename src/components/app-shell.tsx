import Link from "next/link";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { StudentSwitcher } from "@/components/student-switcher";
import { getStudentSelectionForParent } from "@/lib/active-student";
import { getCurrentUser } from "@/lib/auth";
import { listNotifications } from "@/lib/app-data";

export async function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <>{children}</>;
  const notifications = await listNotifications(user.id);
  const selection = user.role === "parent" ? await getStudentSelectionForParent(user.id) : { students: [], activeStudent: null };
  const students = selection.students;
  const activeStudent = selection.activeStudent;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="shell flex items-center justify-between py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-blue-600">{user.role === "admin" ? "Administration" : "Espace parent"}</p>
            <h1 className="text-xl font-bold text-slate-950">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600 sm:block">{notifications.length} alerte(s)</div>
            <form action="/api/auth/logout" method="post">
              <button className="btn-secondary">Déconnexion</button>
            </form>
          </div>
        </div>
      </header>
      <div className="shell py-6">
        {user.role === "parent" ? <PwaInstallPrompt /> : null}
        {user.role === "parent" ? (
          <nav className="mb-6 grid grid-cols-2 gap-3 rounded-3xl bg-white p-3 shadow-sm md:grid-cols-5">
            <Link href="/app" className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Aujourd’hui</Link>
            <Link href="/app/progression" className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Progression</Link>
            <Link href="/app/travaux" className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Travaux</Link>
            <Link href="/app/preparer-un-devoir" className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Devoir</Link>
            <Link href="/app/parametres" className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Plus</Link>
          </nav>
        ) : null}
        {user.role === "parent" && activeStudent ? (
          <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <div>
              Élève actif : <span className="font-semibold text-slate-900">{activeStudent.first_name}</span> · {activeStudent.level}
            </div>
            <StudentSwitcher
              students={students.map((student) => ({
                id: student.id,
                firstName: student.first_name,
                level: student.level,
              }))}
              activeStudentId={activeStudent.id}
            />
          </div>
        ) : null}
        {user.role === "parent" && user.licenseExpiringSoon ? (
          <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Licence active jusqu’à expiration prochaine. Renouvellement conseillé sous {user.licenseDaysRemaining ?? "peu"} jour(s).
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
