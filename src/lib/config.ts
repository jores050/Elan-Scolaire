export const APP_NAME = "Elan Scolaire";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
export function getAbsoluteHttpUrl(value: string | undefined) {
  const candidate = value?.trim();

  if (!candidate) return "";

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export const PURCHASE_URL = getAbsoluteHttpUrl(process.env.NEXT_PUBLIC_PURCHASE_URL);
export const HAS_PURCHASE_URL = PURCHASE_URL.length > 0;
export const SUPPORT_GROUP_URL = process.env.SUPPORT_GROUP_URL || "";
export const COOKIE_NAME = "elan_session";
export const LICENSE_WEBHOOK_SECRET = process.env.LICENSE_WEBHOOK_SECRET || "";
export const MAX_UPLOAD_FILES = 4;
export const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;
export const STORAGE_BUCKET = "student-work";
export const SIGNED_URL_EXPIRES_SECONDS = 60 * 5;
export const DATA_DIR = "data";
export const DB_FILE = "data/dev-db.json";
export const TEST_UPLOAD_DIR = "data/test-storage";
