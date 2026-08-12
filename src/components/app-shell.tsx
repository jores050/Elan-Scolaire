import Link from "next/link";
import { clearLoginSession, getCurrentUser } from "@/lib/auth";
import { listNotifications, listStudentsForParent } from "@/lib/app-data";

export async function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <>{children}</>;
  const notifications = await listNotifications(user.id);
  const students = user.role === "parent" ? await listStudentsForParent(user.id) : [];

  async function logoutAction() {
    "use server";
    await clearLoginSession();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="shell flex items-center justify-between py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-blue-600">{user.role === "admin" ? "Administration" : "Espace parent"}</p>
            <h1 className="text-xl font-bold text-slate-950">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600 sm:block">{notifications.length} notification(s)</div>
            <form action={logoutAction}>
              <button className="btn-secondary">Déconnexion</button>
            </form>
          </div>
        </div>
      </header>
      <div className="shell py-6">
        {user.role === "parent" ? (
          <nav className="mb-6 grid grid-cols-2 gap-3 rounded-3xl bg-white p-3 shadow-sm md:grid-cols-5">
            <Link href="/app" className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Aujourd’hui</Link>
            <Link href="/app/progression" className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Progression</Link>
            <Link href="/app/travaux" className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Travaux</Link>
            <Link href="/app/preparer-un-devoir" className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Devoir</Link>
            <Link href="/app/parametres" className="rounded-2xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Plus</Link>
          </nav>
        ) : null}
        {user.role === "parent" && students[0] ? (
          <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Élève actif : <span className="font-semibold text-slate-900">{students[0].firstName}</span> · {students[0].level}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
