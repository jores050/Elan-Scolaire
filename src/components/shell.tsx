import Link from "next/link";
import { HAS_PURCHASE_URL, PURCHASE_URL } from "@/lib/config";
import { PurchaseLinkClient, PURCHASE_CTA } from "@/components/purchase-link";

export { PURCHASE_CTA };

export function PurchaseLink({ className = "", compact = false, header = false }: { className?: string; compact?: boolean; header?: boolean }) {
  return <PurchaseLinkClient purchaseUrl={HAS_PURCHASE_URL ? PURCHASE_URL : ""} className={className} compact={compact} header={header} />;
}

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="shell flex items-center justify-between gap-3 py-3">
        <Link href="/" className="text-lg font-bold text-slate-900">
          Elan Scolaire
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <PurchaseLink header className="min-h-11 px-4 py-2 shadow-none" />
          <Link href="/connexion" className="landing-link-button px-3 sm:px-4">
            Connexion
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="shell flex flex-col gap-5 py-8 text-sm text-slate-600 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-bold text-slate-950">Elan Scolaire</p>
          <p className="mt-1">Réussir les Maths 3e · Elan Scolaire</p>
        </div>
        <nav aria-label="Liens de pied de page" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/connexion" className="hover:text-blue-700">Connexion</Link>
          <Link href="/confidentialite" className="hover:text-blue-700">Confidentialité</Link>
        </nav>
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
