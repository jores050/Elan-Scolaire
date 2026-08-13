import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/shell";

const messages: Record<string, string> = {
  valide: "Clé valide. Vous pouvez maintenant créer votre compte parent.",
  invalide: "Clé invalide.",
  deja_utilisee: "Cette clé a déjà été utilisée.",
  desactivee: "Cette clé a été désactivée.",
  expiree: "Cette clé est expirée.",
};

export default async function ActivationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const code = typeof params.code === "string" ? params.code : "";
  return (
    <div>
      <PublicHeader />
      <main className="shell py-14">
        <div className="mx-auto max-w-xl card">
          <h1 className="text-3xl font-bold text-slate-950">Activez votre accès Elan Scolaire</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Votre guide comprend un accès à Elan Scolaire. Saisissez la clé unique reçue après votre achat pour activer le suivi de votre enfant.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Format attendu : ELAN-3E-XXXX-XXXX-XXXX</p>
          {status ? <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">{messages[status] ?? "Statut inconnu."}</div> : null}
          <form action="/api/licenses/verify" method="post" className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="license">
                Clé d’activation
              </label>
              <input id="license" name="license" className="input uppercase" placeholder="ELAN-3E-XXXX-XXXX-XXXX" defaultValue={code} required />
            </div>
            <button className="btn-primary w-full">Vérifier ma clé</button>
          </form>
          <p className="mt-4 text-sm text-slate-600">
            Vous avez déjà un compte ? <Link href="/connexion" className="font-semibold text-blue-700">Connectez-vous</Link>
          </p>
          <p className="mt-3 text-sm text-slate-600">
            <Link href="/bienvenue" className="font-semibold text-blue-700">Bienvenue après achat</Link>
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
