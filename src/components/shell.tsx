import Link from "next/link";
import { HAS_PURCHASE_URL, PURCHASE_URL } from "@/lib/config";

export function PublicHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="shell flex items-center justify-between py-4">
        <Link href="/" className="text-lg font-bold text-slate-900">
          Elan Scolaire
        </Link>
        <nav className="hidden gap-5 text-sm text-slate-600 md:flex">
          <Link href="/demo">Démo</Link>
          <Link href="/activation">Activer ma clé</Link>
          <Link href="/confidentialite">Confidentialité</Link>
        </nav>
        <div className="flex gap-3">
          <Link href="/connexion" className="btn-secondary">
            Connexion
          </Link>
          {HAS_PURCHASE_URL ? (
            <a href={PURCHASE_URL} className="btn-primary">
              Obtenir ce pack
            </a>
          ) : (
            <span className="btn-primary opacity-60">Achat à configurer</span>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="shell py-8 text-sm text-slate-500">
        <p>Elan Scolaire — Suivi scolaire intelligent pour les mathématiques de 3e au Bénin.</p>
      </div>
    </footer>
  );
}

export function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="max-w-2xl space-y-3">
      {eyebrow ? <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">{eyebrow}</p> : null}
      <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h2>
      {description ? <p className="text-base leading-7 text-slate-600">{description}</p> : null}
    </div>
  );
}

export function DemoBadge() {
  return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Mode démonstration</span>;
}
