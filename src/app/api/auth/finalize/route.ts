import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACTIVATION_COOKIE } from "@/lib/activation-token";
import { finalizeAuthenticatedUser } from "@/lib/auth-finalize";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const activationToken = cookieStore.get(ACTIVATION_COOKIE)?.value ?? null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/connexion?error=service", request.url), 303);
  }

  try {
    const { destination, activationContextPresent } = await finalizeAuthenticatedUser(user, activationToken);
    const response = NextResponse.redirect(new URL(destination, request.url), 303);
    if (activationContextPresent) {
      response.cookies.delete(ACTIVATION_COOKIE);
    }
    return response;
  } catch (error) {
    console.error("[auth/finalize] failed", {
      userId: user.id,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.redirect(new URL("/activation?status=invalide", request.url), 303);
  }
}
