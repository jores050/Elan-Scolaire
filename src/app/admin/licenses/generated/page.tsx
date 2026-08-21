import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";

export default async function GeneratedLicensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const rawKeys = typeof params.keys === "string" ? params.keys : "";
  const keys = rawKeys.split("\n").map((key) => key.trim()).filter(Boolean);

  return (
    <AppShell title="Clés générées">
      <div className="card">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Clés générées</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Copiez ces clés maintenant. Pour des raisons de sécurité, les clés complètes ne sont affichées qu’à ce moment.
            </p>
          </div>
          <Link href="/admin" className="btn-secondary">Retour admin</Link>
        </div>

        {keys.length ? (
          <div className="mt-6 space-y-3">
            <textarea readOnly className="input min-h-56 font-mono text-sm" value={keys.join("\n")} aria-label="Clés générées" />
            <div className="grid gap-3 md:grid-cols-2">
              {keys.map((key) => (
                <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm font-bold text-slate-900">
                  {key}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            Aucune clé à afficher. Générez de nouvelles clés depuis l’administration.
          </p>
        )}
      </div>
    </AppShell>
  );
}
