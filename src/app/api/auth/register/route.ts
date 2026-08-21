import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACTIVATION_COOKIE, readActivationContext } from "@/lib/activation-token";
import { getSignupErrorTarget, isExistingAccountError } from "@/lib/auth-finalize";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const activationContext = readActivationContext(cookieStore.get(ACTIVATION_COOKIE)?.value);
  if (!activationContext) return NextResponse.redirect(new URL("/activation?status=invalide", request.url));

  const formData = await request.formData();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return NextResponse.redirect(new URL("/inscription?error=missing_fields", request.url), 303);
  }

  if (password.length < 8) {
    return NextResponse.redirect(new URL("/inscription?error=weak_password", request.url), 303);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  const identitiesCount = Array.isArray(data.user?.identities) ? data.user.identities.length : null;
  const signupErrorMessage = error?.message ?? null;
  const accountAlreadyExists = isExistingAccountError(signupErrorMessage, Boolean(data.user) && !data.session ? identitiesCount : null);

  if (accountAlreadyExists) {
    return NextResponse.redirect(new URL("/connexion?error=already_exists", request.url), 303);
  }

  if (error || !data.user) {
    return NextResponse.redirect(new URL(getSignupErrorTarget(signupErrorMessage), request.url), 303);
  }

  if (!data.session) {
    return NextResponse.redirect(new URL("/inscription?status=confirm-email", request.url), 303);
  }

  return NextResponse.redirect(new URL("/api/auth/finalize", request.url), 303);
}
