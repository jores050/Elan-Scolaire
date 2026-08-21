import Link from "next/link";
import { cookies } from "next/headers";
import { ACTIVATION_COOKIE, hasValidMarketouAccess } from "@/lib/activation-token";

const errors: Record<string, string> = {
  invalid: "Email ou mot de passe incorrect.",
  service: "Connexion temporairement indisponible. Vérifiez votre connexion Internet puis réessayez.",
  admin: "Accès administrateur requis.",
  already_exists: "Un compte existe déjà avec cette adresse. Connectez-vous pour terminer l’activation.",
};

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  const cookieStore = await cookies();
  const isMarketouAccess = hasValidMarketouAccess(cookieStore.get(ACTIVATION_COOKIE)?.value);
  return (
    <main className="shell py-14">
      <div className="mx-auto max-w-xl card">
        <h1 className="text-3xl font-bold text-slate-950">Connexion</h1>
        <p className="mt-3 text-sm text-slate-600">Connectez-vous avec l’email et le mot de passe de votre compte Elan Scolaire.</p>
        {isMarketouAccess ? <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-slate-700">Votre accès Marketou est prêt. Connectez-vous pour rattacher automatiquement votre accès ÉLAN à ce compte si nécessaire.</div> : null}
        {error ? <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{errors[error] ?? "Erreur de connexion."}</div> : null}
        <form action="/api/auth/login" method="post" className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" className="input" type="email" required />
          </div>
          <div>
            <label className="label" htmlFor="password">Mot de passe</label>
            <input id="password" name="password" className="input" type="password" required />
          </div>
          <button className="btn-primary w-full">Se connecter</button>
        </form>
        <div className="mt-6 border-t border-slate-200 pt-6 text-center">
          <p className="text-sm text-slate-600">Première fois après achat ?</p>
          <Link href="/activation" className="btn-secondary mt-3 w-full">Activer mon accès</Link>
        </div>
      </div>
    </main>
  );
}
