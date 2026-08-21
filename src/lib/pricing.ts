export const LAUNCH_PRICE = 2500;
export const NORMAL_PRICE = 4000;
export const PRICE_CURRENCY = "XOF";
export const LAUNCH_OFFER_ENDS_AT =
  process.env.NEXT_PUBLIC_LAUNCH_OFFER_ENDS_AT ?? "2026-10-02T00:00:34+01:00";

export function formatFcfa(amount: number) {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
}

export function isLaunchOfferActive(deadline = LAUNCH_OFFER_ENDS_AT, now = new Date()) {
  const end = new Date(deadline).getTime();
  return Number.isFinite(end) && now.getTime() < end;
}

export function getCurrentPrice(deadline = LAUNCH_OFFER_ENDS_AT, now = new Date()) {
  return isLaunchOfferActive(deadline, now) ? LAUNCH_PRICE : NORMAL_PRICE;
}

export function getPurchaseCta(deadline = LAUNCH_OFFER_ENDS_AT, now = new Date()) {
  return `Obtenir Réussir les Maths 3e — ${formatFcfa(getCurrentPrice(deadline, now))}`;
}
