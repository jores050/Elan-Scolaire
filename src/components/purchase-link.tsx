"use client";

import { useEffect, useState } from "react";
import { formatFcfa, getCurrentPrice, getPurchaseCta, LAUNCH_OFFER_ENDS_AT } from "@/lib/pricing";

function usePurchaseCta() {
  const [price, setPrice] = useState(() => getCurrentPrice());

  useEffect(() => {
    const refresh = () => setPrice(getCurrentPrice(LAUNCH_OFFER_ENDS_AT));
    refresh();
    const timer = window.setInterval(refresh, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    priceLabel: formatFcfa(price),
    cta: `Obtenir Réussir les Maths 3e — ${formatFcfa(price)}`,
  };
}

export function PurchaseLinkClient({ purchaseUrl, className = "", compact = false, header = false }: { purchaseUrl: string; className?: string; compact?: boolean; header?: boolean }) {
  const { priceLabel, cta } = usePurchaseCta();
  const label = header ? (
    <>
      <span className="sm:hidden">Acheter</span>
      <span className="hidden sm:inline">{cta}</span>
    </>
  ) : compact ? (
    <>
      <span className="sm:hidden">Obtenir — {priceLabel}</span>
      <span className="hidden sm:inline">{cta}</span>
    </>
  ) : cta;

  return purchaseUrl ? (
    <a href={purchaseUrl} aria-label={cta} className={`landing-cta ${className}`}>
      {label}
    </a>
  ) : (
    <span className={`landing-cta cursor-not-allowed opacity-60 ${className}`} aria-disabled="true">
      Achat bientôt disponible
    </span>
  );
}

export const PURCHASE_CTA = getPurchaseCta();
