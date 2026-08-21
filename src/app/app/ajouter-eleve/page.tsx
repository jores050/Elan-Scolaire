import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { listStudentsForParent } from "@/lib/app-data";
import { requireParentAccess } from "@/lib/auth";

export default async function AjouterElevePage() {
  const user = await requireParentAccess();
  const existingStudents = await listStudentsForParent(user.id);
  if (existingStudents.length > 0) redirect("/app");

  return (
    <AppShell title="Ajouter mon enfant">
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="card border-blue-200 bg-blue-50">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Bienvenue sur ÉLAN</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Commençons par l’élève que vous souhaitez accompagner.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Nous allons simplement créer son profil, puis ÉLAN vous guidera vers la première étape :
            le diagnostic papier dans le Guide 1.
          </p>
        </section>
        <section className="card">
          <h2 className="text-2xl font-bold text-slate-950">Ajouter mon enfant</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Renseignez uniquement les informations utiles pour préparer le bon parcours.
          </p>
        <form action="/api/app/students" method="post" className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="studentName">Prénom de l’enfant</label>
            <input id="studentName" name="studentName" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="level">Classe</label>
            <input id="level" name="level" className="input" defaultValue="3e" required />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="school">Établissement (facultatif)</label>
            <input id="school" name="school" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="currentAreaSlug">Où en est-il actuellement ?</label>
            <select id="currentAreaSlug" name="currentAreaSlug" className="input">
              <option value="sa1">Début de 3e / SA1</option>
              <option value="sa2">SA2</option>
              <option value="sa3">SA3</option>
              <option value="sa4">SA4</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="objective">Objectif principal</label>
            <select id="objective" name="objective" className="input">
              <option value="reprendre_les_bases">Reprendre les bases</option>
              <option value="suivre_les_cours">Suivre les cours</option>
              <option value="preparer_un_devoir">Préparer un devoir</option>
              <option value="preparer_le_bepc">Préparer le BEPC</option>
            </select>
          </div>
          <button className="btn-primary md:col-span-2">Ajouter mon enfant</button>
        </form>
        </section>
      </div>
    </AppShell>
  );
}
