import { NextResponse } from "next/server";
import { ACTIVATION_COOKIE, activationCookieOptions, createMarketouAccessToken } from "@/lib/activation-token";
import { isValidMarketouAccess } from "@/lib/marketou-access";

export async function POST(request: Request) {
  const formData = await request.formData();
  const source = String(formData.get("source") ?? "");
  const key = String(formData.get("key") ?? "");
  const intent = String(formData.get("intent") ?? "register");

  if (!isValidMarketouAccess({ source, key })) {
    return NextResponse.redirect(new URL("/activation?status=invalide", request.url), 303);
  }

  const destination = intent === "login" ? "/connexion" : "/inscription";
  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  response.cookies.set(ACTIVATION_COOKIE, createMarketouAccessToken(), activationCookieOptions);
  return response;
}
