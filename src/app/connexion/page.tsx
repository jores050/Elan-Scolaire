const errors: Record<string, string> = {
  invalid: "Email ou mot de passe incorrect.",
  admin: "Accès administrateur requis.",
};

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  return (
    <main className="shell py-14">
      <div className="mx-auto max-w-xl card">
        <h1 className="text-3xl font-bold text-slate-950">Connexion parent / admin</h1>
        <p className="mt-3 text-sm text-slate-600">Connectez-vous avec votre compte Elan Scolaire. En production, les accès sont gérés via Supabase Auth.</p>
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
      </div>
    </main>
  );
}
