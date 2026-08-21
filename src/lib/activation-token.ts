import { createHmac, timingSafeEqual } from "node:crypto";

export const ACTIVATION_COOKIE = "elan_pending_activation";
const MAX_AGE_SECONDS = 20 * 60;

type ActivationCookiePayload =
  | { kind: "license"; code: string; exp: number }
  | { kind: "marketou_access"; source: "marketou"; exp: number };

function getActivationSecret() {
  const configured = process.env.LICENSE_WEBHOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "elan-dev-activation-secret";
  return null;
}

function sign(payload: string) {
  const secret = getActivationSecret();
  if (!secret) throw new Error("Activation token secret is missing.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createActivationToken(code: string) {
  const payload = Buffer.from(JSON.stringify({
    kind: "license",
    code: code.trim().toUpperCase(),
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  } satisfies ActivationCookiePayload)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function createMarketouAccessToken() {
  const payload = Buffer.from(JSON.stringify({
    kind: "marketou_access",
    source: "marketou",
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  } satisfies ActivationCookiePayload)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readActivationContext(token?: string | null) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  let expected = "";
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ActivationCookiePayload;
    if (!data.exp || Date.now() > data.exp) return null;
    if (data.kind === "license" && data.code) return data;
    if (data.kind === "marketou_access" && data.source === "marketou") return data;
    return null;
  } catch {
    return null;
  }
}

export function readActivationToken(token?: string | null) {
  const context = readActivationContext(token);
  return context?.kind === "license" ? context.code : null;
}

export function hasValidMarketouAccess(token?: string | null) {
  const context = readActivationContext(token);
  return context?.kind === "marketou_access" && context.source === "marketou";
}

export const activationCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
