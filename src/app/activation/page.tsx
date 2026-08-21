import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/shell";
import { isValidMarketouAccess } from "@/lib/marketou-access";

const messages: Record<string, string> = {
  invalide: "Cette clé n’est pas valide. Vérifiez-la puis réessayez.",
  deja_utilisee: "Cette clé a déjà été activée.",
  desactivee: "Cette clé ne peut plus être utilisée.",
  expiree: "Votre licence ÉLAN a expiré. Les données de vos élèves sont conservées, mais les fonctionnalités premium restent bloquées jusqu’au renouvellement.",
};

export default async function ActivationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const source = typeof params.source === "string" ? params.source : "";
  const key = typeof params.key === "string" ? params.key : "";
  const hasValidMarketouAccess = isValidMarketouAccess({ source, key });
  return (
    <div>
      <PublicHeader />
      <main className="shell py-14">
        <div className="mx-auto max-w-xl card">
          {hasValidMarketouAccess ? (
            <>
              <h1 className="text-3xl font-bold text-slate-950">Bienvenue dans ÉLAN Scolaire</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Votre accès ÉLAN est inclus avec votre achat.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Créez votre compte parent pour commencer l’accompagnement de votre enfant.
              </p>
              <p className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-slate-700">
                Nous vous conseillons d’utiliser l’adresse e-mail utilisée lors de votre achat.
              </p>
              <div className="mt-6 grid gap-3">
                <form action="/api/marketou/access" method="post">
                  <input type="hidden" name="source" value={source} />
                  <input type="hidden" name="key" value={key} />
                  <input type="hidden" name="intent" value="register" />
                  <button className="btn-primary w-full">Créer mon compte</button>
                </form>
                <form action="/api/marketou/access" method="post">
                  <input type="hidden" name="source" value={source} />
                  <input type="hidden" name="key" value={key} />
                  <input type="hidden" name="intent" value="login" />
                  <button className="btn-secondary w-full">J’ai déjà un compte</button>
                </form>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-slate-950">Activez votre accès</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Entrez la clé reçue après votre achat. Elle permet d’activer ou de réactiver votre espace ÉLAN Scolaire.
              </p>
              {status ? <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{messages[status] ?? "Impossible de vérifier cette clé."}</div> : null}
              <form action="/api/licenses/verify" method="post" className="mt-6 space-y-4">
                <div>
                  <label className="label" htmlFor="license">Clé d’activation</label>
                  <input id="license" name="license" className="input uppercase" placeholder="ELAN-3E-XXXX-XXXX-XXXX" required />
                </div>
                <button className="btn-primary w-full">Continuer</button>
              </form>
              <p className="mt-5 text-center text-sm text-slate-600">
                Vous avez déjà activé votre accès ? <Link href="/connexion" className="font-semibold text-blue-700">Connectez-vous</Link>
              </p>
            </>
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
