"use client";

import { useState } from "react";

type DemoView = "seance" | "analyse" | "parent";

const views: Array<{ id: DemoView; label: string }> = [
  { id: "seance", label: "Séance" },
  { id: "analyse", label: "Analyse" },
  { id: "parent", label: "Parent" },
];

export function LandingDemo() {
  const [view, setView] = useState<DemoView>("seance");

  return (
    <div className="landing-demo">
      <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm font-semibold text-slate-200">Démonstration fictive. Aucune donnée n’est enregistrée.</p>
        <div className="flex rounded-full bg-slate-950 p-1" role="tablist" aria-label="Écrans de démonstration">
          {views.map((item) => (
            <button key={item.id} type="button" role="tab" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`} aria-selected={view === item.id} onClick={() => setView(item.id)} className={`min-h-11 flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${view === item.id ? "bg-yellow-400 text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-8">
        {view === "seance" ? (
          <section className="demo-panel" role="tabpanel" id="panel-seance" aria-labelledby="tab-seance">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-500">Bonjour</p><h3 className="mt-1 text-2xl font-bold text-slate-950">Voici ton travail aujourd’hui</h3></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Jour 3 sur 14</span></div>
            <div className="mt-6 rounded-3xl bg-emerald-950 p-5 text-white"><p className="text-sm font-bold uppercase tracking-wide text-yellow-300">Programme de rappel</p><h4 className="mt-3 text-2xl font-bold">Expressions littérales</h4><p className="mt-2 text-sm text-emerald-100">Temps conseillé · 25 min</p><div className="mt-5 rounded-2xl bg-white/10 p-4"><p className="text-sm text-emerald-100">Dans ton guide</p><p className="mt-1 font-bold">Fais les exercices 4 et 5 sur ton cahier.</p></div></div>
            <div className="mt-5"><div className="mb-2 flex justify-between text-sm font-semibold text-slate-600"><span>Progression</span><span>Jour 3 sur 14</span></div><div className="h-2 rounded-full bg-slate-200"><div className="h-full w-[21%] rounded-full bg-emerald-600" /></div></div>
            <button type="button" onClick={() => setView("analyse")} className="landing-cta mt-6 w-full">J’ai terminé ma copie</button>
          </section>
        ) : null}

        {view === "analyse" ? (
          <section className="demo-panel" role="tabpanel" id="panel-analyse" aria-labelledby="tab-analyse">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wide text-blue-700">Copie analysée</p><h3 className="mt-2 text-3xl font-bold text-slate-950">Voici ce qu’il faut retenir.</h3></div><p className="text-5xl font-bold text-emerald-700">7 <span className="text-2xl text-slate-400">/ 10</span></p></div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm font-bold text-emerald-800">✓ Réussi</p><p className="mt-2 font-bold">Calcul des termes semblables</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-sm font-bold text-amber-900">! À revoir</p><p className="mt-2 font-bold">Signes devant une parenthèse</p></div></div>
            <div className="mt-4 rounded-2xl bg-blue-50 p-5"><p className="font-bold text-blue-900">Conseil : reprends l’exemple guidé</p><p className="mt-2 text-sm leading-6 text-slate-700">Relis la méthode sur la suppression des parenthèses, puis refais l’exercice 5.</p></div>
            <button type="button" onClick={() => setView("parent")} className="landing-cta mt-6 w-full">Voir ce que voit le parent</button>
          </section>
        ) : null}

        {view === "parent" ? (
          <section className="demo-panel" role="tabpanel" id="panel-parent" aria-labelledby="tab-parent">
            <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Espace parent</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h3 className="text-3xl font-bold text-slate-950">Progression cette semaine</h3><p className="mt-2 text-slate-600">4 séances réalisées sur 5</p></div><span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800">Bonne progression</span></div>
            <div className="mt-6 h-3 rounded-full bg-slate-200"><div className="h-full w-4/5 rounded-full bg-emerald-600" /></div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-emerald-50 p-5"><p className="text-sm font-bold text-emerald-800">Point fort</p><p className="mt-2 text-lg font-bold">Calcul numérique</p></div><div className="rounded-2xl bg-amber-50 p-5"><p className="text-sm font-bold text-amber-900">À renforcer</p><p className="mt-2 text-lg font-bold">Expressions littérales</p></div></div>
            <div className="mt-4 rounded-2xl bg-slate-950 p-5 text-white"><p className="text-sm font-bold text-yellow-300">Conseil parent</p><p className="mt-2 leading-7 text-slate-200">Encouragez votre enfant à terminer la séance de consolidation prévue demain.</p></div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
