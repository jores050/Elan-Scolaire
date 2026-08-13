import { PublicFooter, PublicHeader } from "@/components/shell";

export default function BienvenuePage() {
  return (
    <div>
      <PublicHeader />
      <main className="shell py-14">
        <div className="mx-auto max-w-2xl card">
          <h1 className="text-3xl font-bold text-slate-950">Bienvenue chez Elan Scolaire 🎉</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Votre guide comprend un accès à Elan Scolaire. Saisissez la clé unique reçue après votre achat pour activer le suivi de votre enfant.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Après activation, vous pourrez créer le compte parent, enregistrer votre enfant et démarrer le programme « PRÊT POUR LA 3e EN 14 JOURS ».
          </p>
          <form action="/api/licenses/verify" method="post" className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="license">
                Clé Elan Scolaire
              </label>
              <input id="license" name="license" className="input uppercase" placeholder="ELAN-3E-XXXX-XXXX-XXXX" required />
            </div>
            <button className="btn-primary">Activer mon suivi</button>
          </form>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
