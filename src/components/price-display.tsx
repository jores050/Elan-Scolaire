"use client";

import { useEffect, useState } from "react";
import { formatFcfa, getCurrentPrice, LAUNCH_OFFER_ENDS_AT } from "@/lib/pricing";

function useCurrentPrice(deadline = LAUNCH_OFFER_ENDS_AT) {
  const [price, setPrice] = useState(() => getCurrentPrice(deadline));

  useEffect(() => {
    const refresh = () => setPrice(getCurrentPrice(deadline));
    refresh();
    const timer = window.setInterval(refresh, 1_000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  return price;
}

export function PriceAmount({ className = "", deadline }: { className?: string; deadline?: string }) {
  const price = useCurrentPrice(deadline);
  return <span className={className}>{formatFcfa(price)}</span>;
}

export function PriceLine({ className = "", deadline }: { className?: string; deadline?: string }) {
  const price = useCurrentPrice(deadline);
  return <span className={className}>{formatFcfa(price)} · Paiement unique</span>;
}
