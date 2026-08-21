import Link from "next/link";
import { DemoBadge, PublicFooter, PublicHeader } from "@/components/shell";
import { ProductDemoMotion } from "@/components/product-demo-motion";
import { HAS_PURCHASE_URL, PURCHASE_URL } from "@/lib/config";

export default function DemoPage() {
  return <div><PublicHeader /><main className="shell py-12">
    <div className="mb-8 flex flex-wrap items-center gap-3"><DemoBadge /><p className="text-sm text-slate-600">Exemple de présentation · aucune donnée personnelle utilisée</p></div>
    <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950">Découvrez le parcours Réussir les Maths 3e</h1>
    <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">Le travail prévu est rappelé dans l’espace, la copie est envoyée en photo ou en PDF, puis l’IA aide à identifier ce qui est réussi et ce qu’il faut reprendre.</p>
    <section className="mt-9" aria-labelledby="demo-features-title">
      <h2 id="demo-features-title" className="sr-only">Fonctions principales de l’application</h2>
      <ProductDemoMotion />
    </section>
    <div className="mt-9 grid gap-6 lg:grid-cols-2">
      <section className="card border-blue-200 bg-blue-50">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Phase 1 · Préparation</p>
        <h2 className="mt-2 text-2xl font-bold">Jour 3 sur 14</h2>
        <p className="mt-2 font-semibold text-slate-800">Réduire une expression littérale</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Travail du jour</p><p className="mt-2 font-bold">2 exercices</p></div>
          <div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Analyse exemple</p><p className="mt-2 font-bold">15/20</p></div>
          <div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Point à revoir</p><p className="mt-2 font-bold">Suppression des parenthèses</p></div>
          <div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Progression</p><p className="mt-2 font-bold">3 jours sur 14</p></div>
        </div>
      </section>
      <section className="card bg-slate-950 text-white">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-300">Après les 14 jours · Exemple fictif</p>
        <h2 className="mt-2 text-2xl font-bold">Semaine 4</h2>
        <p className="mt-2 font-semibold text-slate-200">Équations</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white/10 p-4"><p className="text-sm text-slate-300">Travail recommandé</p><p className="mt-2 font-bold">Reprendre la méthode</p></div>
          <div className="rounded-2xl bg-white/10 p-4"><p className="text-sm text-slate-300">Progression</p><p className="mt-2 font-bold">2/4 items</p></div>
          <div className="rounded-2xl bg-white/10 p-4 sm:col-span-2"><p className="text-sm text-slate-300">Point à revoir</p><p className="mt-2 font-bold">Isoler l’inconnue</p></div>
        </div>
      </section>
    </div>
    <section className="card mt-6"><p className="font-bold text-slate-950">Mode démonstration</p><p className="mt-2 text-sm leading-6 text-slate-700">Cet exemple illustre le passage des 14 jours à l’accompagnement de la 3e. Il ne représente aucun élève réel et n’enregistre aucune information.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/activation" className="btn-primary">J’ai déjà acheté</Link>{HAS_PURCHASE_URL ? <a href={PURCHASE_URL} className="btn-secondary">Acheter le pack</a> : <span className="btn-secondary opacity-60">Achat bientôt disponible</span>}</div></section>
  </main><PublicFooter /></div>;
}
