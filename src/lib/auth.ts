import { redirect } from "next/navigation";
import { getLicenseDaysRemaining, isLicenseCurrentlyValid, isLicenseExpiringSoon } from "@/lib/licenses";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, full_name, active_license_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  let hasPremiumAccess = profile?.role === "admin";
  let licenseExpiresAt: string | null = null;
  let licenseDaysRemaining: number | null = null;
  let licenseExpiringSoon = false;
  if (profile?.active_license_id) {
    const { data: license } = await admin
      .from("license_keys")
      .select("status, expires_at")
      .eq("id", profile.active_license_id)
      .maybeSingle();
    licenseExpiresAt = license?.expires_at ?? null;
    licenseDaysRemaining = getLicenseDaysRemaining(license);
    licenseExpiringSoon = isLicenseExpiringSoon(license);
    hasPremiumAccess = Boolean(hasPremiumAccess || isLicenseCurrentlyValid(license));
  }

  return {
    id: userData.user.id,
    email: userData.user.email ?? "",
    fullName: profile?.full_name ?? userData.user.user_metadata?.full_name ?? "Parent",
    role: profile?.role ?? "parent",
    activeLicenseId: profile?.active_license_id ?? null,
    hasPremiumAccess,
    licenseExpiresAt,
    licenseDaysRemaining,
    licenseExpiringSoon,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/connexion?error=admin");
  return user;
}

export async function getPostLoginDestination(user: { id: string; role: string; activeLicenseId: string | null; hasPremiumAccess?: boolean }) {
  if (user.role === "admin") return "/admin";
  if (!user.activeLicenseId || user.hasPremiumAccess === false) return "/activation";
  const supabase = createAdminClient();
  if (user.hasPremiumAccess == null && user.activeLicenseId) {
    const { data: license, error: licenseError } = await supabase
      .from("license_keys")
      .select("status, expires_at")
      .eq("id", user.activeLicenseId)
      .maybeSingle();
    if (licenseError) throw licenseError;
    if (!isLicenseCurrentlyValid(license)) return "/activation";
  }
  const { count, error } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("parent_user_id", user.id);
  if (error) throw error;
  return (count ?? 0) > 0 ? "/app" : "/app/ajouter-eleve";
}

export async function requireParentAccess(options: { requireStudent?: boolean } = {}) {
  const user = await requireUser();
  if (user.role === "admin") redirect("/admin");
  if (!user.activeLicenseId) redirect("/activation");
  if (!user.hasPremiumAccess) redirect("/activation?status=expiree");
  const destination = await getPostLoginDestination(user);
  if (options.requireStudent && destination === "/app/ajouter-eleve") redirect(destination);
  return user;
}

export async function clearLoginSession() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
