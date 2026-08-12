import { NextResponse } from "next/server";
import { verifyLicense } from "@/lib/app-data";

export async function POST(request: Request) {
  const formData = await request.formData();
  const license = String(formData.get("license") ?? "").trim().toUpperCase();
  const result = await verifyLicense(license);
  if (!result.ok) {
    return NextResponse.redirect(new URL(`/activation?status=${result.reason}&code=${encodeURIComponent(license)}`, request.url));
  }
  return NextResponse.redirect(new URL(`/inscription?license=${encodeURIComponent(license)}`, request.url));
}
