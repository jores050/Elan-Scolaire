import Link from "next/link";
import { DemoBadge, PublicFooter, PublicHeader, SectionTitle } from "@/components/shell";
import { PremiumGate } from "@/components/premium-gate";
import { HAS_PURCHASE_URL, PURCHASE_URL } from "@/lib/config";

const faq = [
  "Comment obtenir une clé ?",
  "Le paiement est-il unique ?",
  "Puis-je suivre plusieurs enfants ?",
  "Le groupe d’accompagnement est-il inclus ?",
  "L’application remplace-t-elle les cours ?",
  "Comment fonctionne l’analyse des copies ?",
];

export default function HomePage() {
  return (
    <div>
      <PublicHeader />
      <main>
        <section className="shell grid gap-10 py-14 md:grid-cols-[1.1fr_0.9fr] md:py-20">
          <div className="space-y-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">PRÊT POUR LA 3e — MATHS BÉNIN</p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              14 jours pour consolider les bases avant la 3e.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              14 jours pour consolider les bases avant la 3e, puis des ressources et un accompagnement pour continuer à progresser.
            </p>
            <div className="flex flex-wrap gap-3">
              {HAS_PURCHASE_URL ? (
                <a href={PURCHASE_URL} className="btn-primary">
                  Obtenir ce pack
                </a>
              ) : (
                <span className="btn-primary opacity-60">Achat à configurer</span>
              )}
              <Link href="/activation" className="btn-secondary">
                J’ai une clé
              </Link>
            </div>
          </div>
          <div className="card space-y-4 bg-slate-950 text-white">
            <DemoBadge />
            <div>
              <p className="text-sm text-slate-300">Pack lancement</p>
              <p className="mt-1 text-3xl font-bold">2 500 FCFA</p>
              <p className="mt-2 text-sm text-slate-200">Paiement unique</p>
            </div>
            <div className="rounded-3xl bg-white/10 p-4">
              <p className="text-sm text-slate-300">Contenu</p>
              <p className="mt-1 text-xl font-semibold">Guide 14 jours + application + accompagnement</p>
              <p className="mt-2 text-sm text-slate-200">Un pack concret, pensé pour préparer l’entrée en 3e sans fausse promesse.</p>
            </div>
          </div>
        </section>

        <section className="shell py-10">
          <SectionTitle eyebrow="Promesse" title="Un pack simple, utile et fidèle au produit" />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              "Le guide 14 jours aide à reprendre les bases essentielles.",
              "L’application suit le jour en cours, les travaux envoyés et les points à revoir.",
              "Le groupe d’accompagnement permet de continuer après les 14 jours si le lien est activé.",
            ].map((item, index) => (
              <div key={item} className="card">
                <p className="text-sm font-semibold text-blue-600">Point {index + 1}</p>
                <p className="mt-3 text-base leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="shell py-10">
          <SectionTitle eyebrow="Le pack" title="Ce que la famille reçoit" />
          <div className="mt-8 card">
            <ul className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <li>Guide 14 jours</li>
              <li>Corrigés détaillés</li>
              <li>Guide formules et méthodes</li>
              <li>35 épreuves réelles 3e / BEPC</li>
              <li>Application de suivi</li>
              <li>Groupe d’accompagnement</li>
            </ul>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-950">PRÊT POUR LA 3e — MATHS BÉNIN</p>
                <p className="mt-1 text-sm text-slate-600">Prix lancement : 2 500 FCFA · Paiement unique</p>
              </div>
              {HAS_PURCHASE_URL ? (
                <a href={PURCHASE_URL} className="btn-primary">Obtenir ce pack</a>
              ) : (
                <span className="btn-primary opacity-60">Achat à configurer</span>
              )}
            </div>
          </div>
        </section>

        <section className="shell py-10">
          <SectionTitle eyebrow="Démo" title="Découvrir l’application sans achat" description="La démonstration montre le travail du jour, la progression, l’analyse et le suivi parent, sans upload réel ni écriture base utilisateur." />
          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_0.9fr]">
            <div className="card space-y-4">
              <DemoBadge />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-sm text-slate-500">Jour du programme</p>
                  <p className="text-xl font-bold text-slate-950">Jour 3 sur 14</p>
                  <p className="mt-2 text-sm text-slate-600">Réduire une expression littérale</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Analyse exemple</p>
                  <p className="text-xl font-bold text-slate-950">15/20</p>
                  <p className="mt-2 text-sm text-slate-600">Retour pédagogique simulé</p>
                </div>
              </div>
              <Link href="/demo" className="btn-primary">
                Ouvrir la démonstration
              </Link>
            </div>
            <PremiumGate compact />
          </div>
        </section>

        <section className="shell py-10">
          <SectionTitle eyebrow="FAQ" title="Questions fréquentes" />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {faq.map((item) => (
              <div key={item} className="card">
                <p className="font-semibold text-slate-950">{item}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  La réponse est alignée sur le produit actuel : un pack à paiement unique avec clé d’activation et suivi parent.
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
