import Link from "next/link";
import { DemoBadge, PublicFooter, PublicHeader } from "@/components/shell";
import { PremiumGate } from "@/components/premium-gate";
import { HAS_PURCHASE_URL, PURCHASE_URL } from "@/lib/config";

export default function DemoPage() {
  return (
    <div>
      <PublicHeader />
      <main className="shell py-12">
        <div className="mb-6 flex items-center gap-3">
          <DemoBadge />
          <p className="text-sm text-slate-600">Démo publique — aucune donnée réelle n’est enregistrée</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="space-y-6">
            <div className="card">
              <p className="text-sm text-slate-500">Travail du jour</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Jour 1 sur 14 · Nombres rationnels</h1>
              <p className="mt-3 text-sm text-slate-600">Objectif : calculer sans changer l’ordre des opérations et manipuler correctement des nombres rationnels simples.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card">
                <p className="text-sm text-slate-500">Progression</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">21 %</p>
                <p className="mt-2 text-sm text-slate-700">3 jours terminés sur 14</p>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">Analyse exemple</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">15/20</p>
                <p className="mt-2 text-sm text-slate-700">Retour simulé, sans IA payante</p>
              </div>
            </div>
            <div className="card">
              <p className="font-semibold text-slate-950">Suivi parent</p>
              <p className="mt-2 text-sm text-slate-700">
                Dans la version complète, le parent voit le jour courant, les copies envoyées, les analyses et les points à revoir.
              </p>
            </div>
          </div>
          <div className="space-y-6">
            <PremiumGate />
            <div className="card">
              <p className="font-semibold text-slate-950">Cette page est une démonstration.</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Aucun vrai upload, aucune vraie IA payante, aucune écriture BDD utilisateur et aucun groupe premium ne sont actifs ici.
              </p>
              <div className="mt-4 flex gap-3">
                <Link href="/activation" className="btn-primary">
                  J’ai une clé
                </Link>
                {HAS_PURCHASE_URL ? (
                  <a href={PURCHASE_URL} className="btn-secondary">
                    Obtenir le guide
                  </a>
                ) : (
                  <span className="btn-secondary opacity-60">Achat à configurer</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
