import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACTIVATION_COOKIE } from "@/lib/activation-token";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error, data } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const invalidCredentials = error?.code === "invalid_credentials" || error?.status === 400;
    console.error("Login failed", {
      code: error?.code ?? "no_user",
      status: error?.status ?? null,
      message: error?.message ?? "No user returned",
    });
    return NextResponse.redirect(
      new URL(`/connexion?error=${invalidCredentials ? "invalid" : "service"}`, request.url),
        303,
    );
  }
  const response = NextResponse.redirect(new URL("/api/auth/finalize", request.url), 303);
  const cookieStore = await cookies();
  if (!cookieStore.get(ACTIVATION_COOKIE)?.value) {
    response.cookies.delete(ACTIVATION_COOKIE);
  }
  return response;
}
