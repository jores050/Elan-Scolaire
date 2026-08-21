export const DEFAULT_LICENSE_DURATION_DAYS = 365;

type LicenseLike = {
  status?: string | null;
  expires_at?: string | null;
};

export function normalizeLicenseDurationDays(input: number | null | undefined) {
  if (!Number.isFinite(input) || Number(input) <= 0) return DEFAULT_LICENSE_DURATION_DAYS;
  return Math.trunc(Number(input));
}

export function computeLicenseExpiry(startedAt: Date, durationDays: number | null | undefined) {
  const expiresAt = new Date(startedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + normalizeLicenseDurationDays(durationDays));
  return expiresAt;
}

export function isLicenseCurrentlyValid(license: LicenseLike | null | undefined, now = new Date()) {
  if (!license || license.status !== "active" || !license.expires_at) return false;
  const expiresAt = new Date(license.expires_at);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
}

export function getLicenseDaysRemaining(license: LicenseLike | null | undefined, now = new Date()) {
  if (!license?.expires_at) return null;
  const expiresAt = new Date(license.expires_at);
  if (!Number.isFinite(expiresAt.getTime())) return null;
  return Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000);
}

export function isLicenseExpiringSoon(license: LicenseLike | null | undefined, days = 14, now = new Date()) {
  if (!isLicenseCurrentlyValid(license, now)) return false;
  const remaining = getLicenseDaysRemaining(license, now);
  return remaining != null && remaining <= days;
}
