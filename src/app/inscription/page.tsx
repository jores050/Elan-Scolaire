export default async function InscriptionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const license = typeof params.license === "string" ? params.license : "";
  return (
    <main className="shell py-14">
      <div className="mx-auto max-w-2xl card">
        <h1 className="text-3xl font-bold text-slate-950">Créer mon compte parent</h1>
        <p className="mt-3 text-sm text-slate-600">Une clé valide correspond à une licence, avec par défaut 1 parent principal et jusqu’à 2 profils élèves.</p>
        <form action="/api/auth/register" method="post" className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label" htmlFor="license">Clé validée</label>
            <input id="license" name="license" className="input uppercase" defaultValue={license} readOnly required />
          </div>
          <div>
            <label className="label" htmlFor="fullName">Nom du parent</label>
            <input id="fullName" name="fullName" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" className="input" type="email" required />
          </div>
          <div>
            <label className="label" htmlFor="password">Mot de passe</label>
            <input id="password" name="password" className="input" type="password" minLength={8} required />
          </div>
          <div>
            <label className="label" htmlFor="studentName">Prénom de l’enfant</label>
            <input id="studentName" name="studentName" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="level">Classe</label>
            <input id="level" name="level" className="input" defaultValue="3e" required />
          </div>
          <div>
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
            <label className="label" htmlFor="currentTopicSlug">Notion actuelle</label>
            <input id="currentTopicSlug" name="currentTopicSlug" className="input" defaultValue="thales" required />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="objective">Objectif</label>
            <select id="objective" name="objective" className="input">
              <option value="reprendre_les_bases">Reprendre les bases</option>
              <option value="suivre_les_cours">Suivre les cours</option>
              <option value="preparer_un_devoir">Préparer un devoir</option>
              <option value="preparer_le_bepc">Préparer le BEPC</option>
            </select>
          </div>
          <button className="btn-primary md:col-span-2">Créer mon compte et activer ma clé</button>
        </form>
      </div>
    </main>
  );
}
