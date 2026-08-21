import Link from "next/link";
import { cookies } from "next/headers";
import { ACTIVATION_COOKIE, readActivationContext } from "@/lib/activation-token";

const errors: Record<string, string> = {
  invalid_email: "L’adresse email saisie n’est pas valide. Vérifiez-la puis réessayez.",
  weak_password: "Le mot de passe doit contenir au moins 8 caractères.",
  missing_fields: "Email et mot de passe sont obligatoires.",
  service: "L’inscription est temporairement indisponible. Réessayez dans un instant.",
};

export default async function InscriptionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const error = typeof params.error === "string" ? params.error : "";
  const cookieStore = await cookies();
  const activationContext = readActivationContext(cookieStore.get(ACTIVATION_COOKIE)?.value);
  const canCreateAccess = Boolean(activationContext);
  const isMarketouAccess = activationContext?.kind === "marketou_access";

  return (
    <main className="shell py-14">
      <div className="mx-auto max-w-2xl card">
        <h1 className="text-3xl font-bold text-slate-950">Créer mon accès Elan Scolaire</h1>
        {canCreateAccess ? (
          <>
            {error ? (
              <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                {errors[error] ?? "Erreur d’inscription."}
              </div>
            ) : null}
            {status === "confirm-email" ? (
              <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-950">Votre compte a été créé.</p>
                <p className="mt-2">Nous vous avons envoyé un email de confirmation.</p>
                <p className="mt-2">Confirmez votre adresse puis connectez-vous pour terminer l’activation de votre accès ÉLAN.</p>
              </div>
            ) : null}
            <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              {isMarketouAccess
                ? "Votre accès Marketou est validé. Créez maintenant votre compte parent."
                : "Votre clé est valide. Créez maintenant votre accès parent."}
            </div>
            <form action="/api/auth/register" method="post" className="mt-6 grid gap-4">
              <div>
                <label className="label" htmlFor="fullName">Prénom ou nom du parent</label>
                <input id="fullName" name="fullName" className="input" required />
              </div>
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" name="email" className="input" type="email" required />
              </div>
              {isMarketouAccess ? <p className="-mt-1 text-sm text-slate-600">Nous vous conseillons d’utiliser la même adresse e-mail que celle utilisée lors de votre achat sur Marketou.</p> : null}
              <div>
                <label className="label" htmlFor="password">Mot de passe</label>
                <input id="password" name="password" className="input" type="password" minLength={8} required />
              </div>
              <button className="btn-primary">Créer mon accès</button>
            </form>
            {status === "confirm-email" ? <div className="mt-5"><Link href="/connexion" className="btn-secondary">J’ai confirmé mon email, me connecter</Link></div> : null}
          </>
        ) : (
          <div className="mt-6 rounded-3xl bg-amber-50 p-6">
            <p className="font-bold text-amber-950">Une clé d’activation est nécessaire pour créer votre accès.</p>
            <p className="mt-2 text-sm leading-6 text-amber-900">Commencez par vérifier la clé reçue après votre achat.</p>
            <Link href="/activation" className="btn-primary mt-5">Activer mon accès</Link>
          </div>
        )}
      </div>
    </main>
  );
}
