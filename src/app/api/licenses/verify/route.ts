import { NextResponse } from "next/server";
import { ACTIVATION_COOKIE, activationCookieOptions, createActivationToken } from "@/lib/activation-token";
import { getCurrentUser, getPostLoginDestination } from "@/lib/auth";
import { activateLicense, verifyLicense } from "@/lib/app-data";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const license = String(formData.get("license") ?? "").trim().toUpperCase();
    const result = await verifyLicense(license);
    const user = await getCurrentUser();

    if (!result.ok) {
      if (result.reason === "deja_utilisee" && user && result.license?.activated_by === user.id) {
        return NextResponse.redirect(new URL(await getPostLoginDestination(user), request.url));
      }
      return NextResponse.redirect(new URL(`/activation?status=${result.reason}`, request.url));
    }

    if (user) {
      await activateLicense(license, user.id);
      const destination = await getPostLoginDestination({ ...user, activeLicenseId: result.license.id });
      return NextResponse.redirect(new URL(destination, request.url));
    }

    const response = NextResponse.redirect(new URL("/inscription", request.url));
    response.cookies.set(ACTIVATION_COOKIE, createActivationToken(license), activationCookieOptions);
    return response;
  } catch (error) {
    console.error("Activation failed", error);
    return NextResponse.redirect(new URL("/activation?status=invalide", request.url));
  }
}
