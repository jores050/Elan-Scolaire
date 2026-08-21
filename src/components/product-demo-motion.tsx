const features = [
  {
    number: "1",
    title: "Rappel du travail dans l’application",
    description: "Dès l’ouverture de son espace, l’élève retrouve le travail prévu pour avancer sans réviser au hasard.",
    visual: (
      <div className="motion-reminder rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Aujourd’hui</p>
        <p className="mt-2 font-bold text-slate-950">2 exercices à terminer</p>
        <p className="mt-1 text-sm text-slate-600">Jour 3 · Expressions littérales</p>
      </div>
    ),
  },
  {
    number: "2",
    title: "Envoi d’une photo ou d’un PDF",
    description: "Après les exercices, le parent ou l’élève envoie la copie directement depuis l’application.",
    visual: (
      <div className="motion-scan relative mx-auto h-28 max-w-48 overflow-hidden rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
        <span className="block h-2 w-3/4 rounded bg-slate-200" />
        <span className="mt-3 block h-2 w-full rounded bg-slate-100" />
        <span className="mt-3 block h-2 w-5/6 rounded bg-slate-100" />
        <span className="mt-3 block h-2 w-2/3 rounded bg-slate-100" />
        <span aria-hidden="true" className="motion-scan-line" />
      </div>
    ),
  },
  {
    number: "3",
    title: "Correction et orientation par l’IA",
    description: "L’analyse montre les réussites, les erreurs, le point à revoir et la prochaine étape pour mieux comprendre le sujet.",
    visual: (
      <div className="motion-guidance space-y-2 rounded-2xl bg-slate-950 p-4 text-sm text-white">
        <p><span className="text-emerald-300">✓ Réussi :</span> calcul des termes semblables</p>
        <p><span className="text-amber-300">À revoir :</span> signes devant une parenthèse</p>
        <p className="rounded-xl bg-blue-600 px-3 py-2 font-semibold">Prochaine étape : reprendre l’exemple guidé</p>
      </div>
    ),
  },
];

export function ProductDemoMotion() {
  return (
    <div className="grid gap-5 lg:grid-cols-3" aria-label="Trois fonctions principales de l’application">
      {features.map((feature) => (
        <article key={feature.number} className="motion-feature-card card flex flex-col">
          <div className="mb-5">{feature.visual}</div>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white">{feature.number}</span>
            <div>
              <h3 className="font-bold text-slate-950">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
