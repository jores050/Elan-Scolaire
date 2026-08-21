import Link from "next/link";
import { HAS_PURCHASE_URL, PURCHASE_URL } from "@/lib/config";

export function PremiumGate({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`card border-dashed border-blue-200 bg-blue-50/70 ${compact ? "p-4" : "p-6"}`}>
      <p className="text-sm font-semibold text-blue-800">Accès inclus avec le pack Elan Scolaire</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        Activez la clé personnelle reçue après votre achat pour accéder au suivi complet.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/activation" className="btn-primary">
          Activer ma clé
        </Link>
        {HAS_PURCHASE_URL ? (
          <a href={PURCHASE_URL} className="btn-secondary">
            Acheter le pack
          </a>
        ) : (
          <span className="btn-secondary opacity-60">Achat bientôt disponible</span>
        )}
      </div>
    </div>
  );
}
