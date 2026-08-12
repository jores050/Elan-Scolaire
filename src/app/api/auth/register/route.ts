import { NextResponse } from "next/server";
import { activateLicense, createProfile, createStudent } from "@/lib/app-data";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const license = String(formData.get("license") ?? "");
  const fullName = String(formData.get("fullName") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  if (error || !data.user) return NextResponse.redirect(new URL("/connexion?error=invalid", request.url));
  await createProfile({ id: data.user.id, email, fullName, role: "parent" });
  await activateLicense(license, data.user.id);
  await createStudent({
    parentUserId: data.user.id,
    firstName: String(formData.get("studentName") ?? ""),
    level: String(formData.get("level") ?? "3e"),
    school: String(formData.get("school") ?? ""),
    currentAreaSlug: String(formData.get("currentAreaSlug") ?? "sa1"),
    currentTopicSlug: String(formData.get("currentTopicSlug") ?? "thales"),
    objective: (String(formData.get("objective") ?? "suivre_les_cours") as "reprendre_les_bases" | "suivre_les_cours" | "preparer_un_devoir" | "preparer_le_bepc"),
    targetMinutes: 35,
    studyDays: [1, 2, 4, 6],
  });
  return NextResponse.redirect(new URL("/app", request.url));
}
