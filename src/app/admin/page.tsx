import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/cards";
import { requireAdmin } from "@/lib/auth";
import { exportLicensesCsv, getAdminDashboard } from "@/lib/app-data";

export default async function AdminPage() {
  await requireAdmin();
  const dashboard = await getAdminDashboard();
  const csv = await exportLicensesCsv();
  return (
    <AppShell title="Administration Elan Scolaire">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Utilisateurs" value={`${dashboard.counts.users}`} />
        <MetricCard label="Licences" value={`${dashboard.counts.licenses}`} />
        <MetricCard label="Élèves" value={`${dashboard.counts.students}`} />
        <MetricCard label="Activations" value={`${dashboard.counts.activations}`} />
        <MetricCard label="Travaux envoyés" value={`${dashboard.counts.submissions}`} />
        <MetricCard label="Analyses IA" value={`${dashboard.counts.analyses}`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-950">Générer des clés</h2>
          <form action="/api/admin/licenses/generate" method="post" className="mt-4 space-y-4">
            <select name="count" className="input">
              <option value="1">1</option>
              <option value="10">10</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <button className="btn-primary">Générer des clés</button>
          </form>
          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-900">Export CSV</p>
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">{csv}</pre>
          </div>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-950">Dernières licences</h2>
          <div className="mt-4 space-y-3">
            {dashboard.latestLicenses.map((license) => (
              <div key={license.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                <p className="font-semibold text-slate-950">•••• {license.key_suffix}</p>
                <p className="text-slate-600">{license.product}</p>
                <p className="text-slate-500">Statut : {license.status}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
