import Link from "next/link";
import { DemoBadge, PublicFooter, PublicHeader } from "@/components/shell";
import { PremiumGate } from "@/components/premium-gate";

export default function DemoPage() {
  return (
    <div>
      <PublicHeader />
      <main className="shell py-12">
        <div className="mb-6 flex items-center gap-3">
          <DemoBadge />
          <p className="text-sm text-slate-600">Profil fictif : Aïcha · Junior · 3e</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="space-y-6">
            <div className="card">
              <p className="text-sm text-slate-500">Bonjour Aïcha 👋</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Junior progresse à 48 %</h1>
              <p className="mt-3 text-sm text-slate-600">Aujourd’hui : Thalès — exercices 3 à 5 · Dernier score : 13/20</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card">
                <p className="text-sm text-slate-500">Notions fortes</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li>Nombres réels</li>
                  <li>Valeur absolue</li>
                </ul>
              </div>
              <div className="card">
                <p className="text-sm text-slate-500">À renforcer</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li>Thalès</li>
                </ul>
              </div>
            </div>
            <div className="card">
              <p className="font-semibold text-slate-950">Analyse exemple</p>
              <p className="mt-2 text-sm text-slate-700">Tu as bien appliqué Thalès, mais tu as inversé les rapports à la question 2.</p>
              <p className="mt-3 text-sm text-slate-600">À revoir : correspondance des côtés · Fais maintenant : exercices 2 et 3.</p>
            </div>
            <div className="card">
              <p className="font-semibold text-slate-950">Préparation devoir</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {["J-4 · Thalès", "J-3 · Triangle rectangle", "J-2 · Trigonométrie", "J-1 · Mini devoir"].map((item) => (
                  <div key={item} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <PremiumGate />
            <div className="card">
              <p className="font-semibold text-slate-950">Vous découvrez actuellement la démonstration.</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Pour suivre réellement votre enfant, activez la clé fournie avec votre guide Elan Scolaire.
              </p>
              <div className="mt-4 flex gap-3">
                <Link href="/activation" className="btn-primary">
                  J’ai une clé
                </Link>
                <Link href="/" className="btn-secondary">
                  Obtenir le guide
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
