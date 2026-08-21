"use client";

import { useEffect, useState } from "react";
import { formatFcfa, LAUNCH_PRICE, NORMAL_PRICE } from "@/lib/pricing";

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

function getRemaining(deadline: string): Remaining | null {
  const end = new Date(deadline).getTime();
  const distance = end - Date.now();
  if (!Number.isFinite(end) || distance <= 0) return null;
  return {
    days: Math.floor(distance / 86_400_000),
    hours: Math.floor((distance / 3_600_000) % 24),
    minutes: Math.floor((distance / 60_000) % 60),
    seconds: Math.floor((distance / 1_000) % 60),
  };
}

export function LaunchOffer({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    const refresh = () => setRemaining(getRemaining(deadline));
    refresh();
    const timer = window.setInterval(refresh, 1_000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  if (!deadline || !remaining) return null;

  return (
    <section className="border-y border-amber-200 bg-amber-50" aria-label="Offre de lancement">
      <div className="shell flex flex-col gap-5 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-amber-900">Offre de lancement</p>
          <p className="mt-1 text-lg font-black text-slate-950">
            Le parcours complet reste à {formatFcfa(LAUNCH_PRICE)} jusqu’à la fin du décompte. Ensuite, le prix passe à {formatFcfa(NORMAL_PRICE)}.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2" aria-live="polite" aria-label={`${remaining.days} jours, ${remaining.hours} heures, ${remaining.minutes} minutes et ${remaining.seconds} secondes restantes`}>
          {[[remaining.days, "jours"], [remaining.hours, "heures"], [remaining.minutes, "min"], [remaining.seconds, "sec"]].map(([value, label]) => (
            <div key={label} className="min-w-16 rounded-2xl bg-slate-950 px-3 py-2 text-center text-white">
              <p className="text-xl font-black text-yellow-300">{String(value).padStart(2, "0")}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-300">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
