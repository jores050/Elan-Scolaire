import { redirect } from "next/navigation";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, active_license_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  return {
    id: userData.user.id,
    email: userData.user.email ?? "",
    fullName: profile?.full_name ?? userData.user.user_metadata?.full_name ?? "Parent",
    role: profile?.role ?? "parent",
    activeLicenseId: profile?.active_license_id ?? null,
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

export async function clearLoginSession() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
