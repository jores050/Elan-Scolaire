import type { User } from "@supabase/supabase-js";
import { readActivationContext } from "@/lib/activation-token";
import { activateLicense, createProfile, provisionMarketouAccessForUser } from "@/lib/app-data";
import { getPostLoginDestination } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export function getSignupErrorTarget(errorMessage: string | null | undefined) {
  const normalized = errorMessage?.toLowerCase() ?? "";
  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "/connexion?error=already_exists";
  }
  if (normalized.includes("email address") && normalized.includes("invalid")) {
    return "/inscription?error=invalid_email";
  }
  if (normalized.includes("password") && (normalized.includes("short") || normalized.includes("weak") || normalized.includes("least"))) {
    return "/inscription?error=weak_password";
  }
  return "/inscription?error=service";
}

export function isExistingAccountError(errorMessage: string | null | undefined, identitiesCount: number | null) {
  const normalized = errorMessage?.toLowerCase() ?? "";
  return normalized.includes("already registered")
    || normalized.includes("already exists")
    || identitiesCount === 0;
}

export async function finalizeAuthenticatedUser(user: User, activationToken?: string | null) {
  const activationContext = readActivationContext(activationToken);

  await createProfile({
    id: user.id,
    email: user.email ?? "",
    fullName: String(user.user_metadata?.full_name ?? "Parent"),
    role: "parent",
    signupSource: activationContext?.kind === "marketou_access" ? "marketou" : undefined,
  });

  if (activationContext?.kind === "marketou_access") {
    await provisionMarketouAccessForUser(user.id);
  } else if (activationContext?.kind === "license") {
    await activateLicense(activationContext.code, user.id);
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, active_license_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  const destination = await getPostLoginDestination({
    id: user.id,
    role: profile?.role ?? "parent",
    activeLicenseId: profile?.active_license_id ?? null,
  });

  return { destination, activationContextPresent: Boolean(activationContext) };
}
