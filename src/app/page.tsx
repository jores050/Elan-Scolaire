import Link from "next/link";
import { DemoBadge, PublicFooter, PublicHeader, SectionTitle } from "@/components/shell";
import { PremiumGate } from "@/components/premium-gate";
import { PURCHASE_URL } from "@/lib/config";

const faq = [
  "Comment obtenir une clé ?",
  "Une clé fonctionne-t-elle plusieurs fois ?",
  "Puis-je suivre plusieurs enfants ?",
  "L’application remplace-t-elle le professeur ?",
  "Mon enfant doit-il avoir son propre téléphone ?",
  "Comment fonctionne l’analyse des exercices ?",
  "Comment accéder au groupe d’accompagnement ?",
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
              Votre enfant entre en 3e ? Aidez-le à travailler au bon rythme.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              Elan Scolaire aide les parents à savoir quoi faire travailler à leur enfant, suivre ses progrès et identifier les notions à renforcer.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/demo" className="btn-primary">
                Découvrir l’application
              </Link>
              <Link href="/activation" className="btn-secondary">
                J’ai déjà ma clé
              </Link>
            </div>
          </div>
          <div className="card space-y-4 bg-slate-950 text-white">
            <DemoBadge />
            <div>
              <p className="text-sm text-slate-300">Bonjour Maman de Junior 👋</p>
              <p className="mt-1 text-2xl font-bold">Progression : 42 %</p>
            </div>
            <div className="rounded-3xl bg-white/10 p-4">
              <p className="text-sm text-slate-300">Aujourd’hui</p>
              <p className="mt-1 text-xl font-semibold">Mathématiques — Thalès</p>
              <p className="mt-2 text-sm text-slate-200">Exercices 3, 4 et 5 · Temps estimé : 35 min</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-slate-300">Dernier travail</p>
                <p className="text-xl font-bold">14/20</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-sm text-slate-300">À renforcer</p>
                <p className="text-xl font-bold">Calcul littéral</p>
              </div>
            </div>
          </div>
        </section>

        <section className="shell py-10">
          <SectionTitle eyebrow="Fonctionnement" title="Comment ça marche en 4 étapes" />
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              "Indiquez où en est votre enfant.",
              "L’application recommande le travail du jour.",
              "L’enfant travaille avec son guide ou son cahier.",
              "Il envoie son travail et reçoit les points à améliorer.",
            ].map((item, index) => (
              <div key={item} className="card">
                <p className="text-sm font-semibold text-blue-600">Étape {index + 1}</p>
                <p className="mt-3 text-base leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="shell py-10">
          <SectionTitle eyebrow="Démo interactive" title="Un aperçu réaliste du tableau de bord" description="Vous pouvez explorer la démo, mais aucune donnée réelle n’est enregistrée." />
          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_0.9fr]">
            <div className="card space-y-4">
              <DemoBadge />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-sm text-slate-500">Aujourd’hui</p>
                  <p className="text-xl font-bold text-slate-950">Thalès</p>
                  <p className="mt-2 text-sm text-slate-600">Exercices 3, 4 et 5</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Temps estimé</p>
                  <p className="text-xl font-bold text-slate-950">35 min</p>
                  <p className="mt-2 text-sm text-slate-600">Séance adaptée à un téléphone</p>
                </div>
              </div>
              <Link href="/demo" className="btn-primary">
                Ouvrir la démonstration
              </Link>
            </div>
            <div className="space-y-4">
              <div className="card">
                <h3 className="text-lg font-semibold text-slate-950">Fonctionnalités</h3>
                <ul className="mt-4 space-y-3 text-sm text-slate-600">
                  <li>Programme de travail personnalisé</li>
                  <li>Suivi de progression</li>
                  <li>Analyse des exercices</li>
                  <li>Préparation aux devoirs</li>
                  <li>Bibliothèque d’épreuves</li>
                  <li>Accompagnement</li>
                </ul>
              </div>
              <PremiumGate compact />
            </div>
          </div>
        </section>

        <section className="shell py-10">
          <SectionTitle eyebrow="Offre" title="Le guide papier ou PDF reste au centre du travail" />
          <div className="mt-8 card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-950">Pack pédagogique « PRÊT POUR LA 3e — MATHS BÉNIN »</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Le guide donne la matière. L’application vous aide à suivre, organiser et corriger l’entraînement.</p>
            </div>
            <a href={PURCHASE_URL} className="btn-primary">
              Obtenir le guide
            </a>
          </div>
        </section>

        <section className="shell py-10">
          <SectionTitle eyebrow="FAQ" title="Questions fréquentes" />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {faq.map((item) => (
              <div key={item} className="card">
                <p className="font-semibold text-slate-950">{item}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Cette réponse est prévue dans la V1 avec un fonctionnement simple, lisible et rassurant pour les parents.
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
