export const MARKETOU_SOURCE = "marketou";

export function isValidMarketouAccess(input: { source?: string | null; key?: string | null }) {
  const expectedKey = process.env.MARKETOU_ACCESS_KEY?.trim();
  if (!expectedKey) return false;
  if ((input.source ?? "").trim().toLowerCase() !== MARKETOU_SOURCE) return false;
  return (input.key ?? "").trim() === expectedKey;
}
