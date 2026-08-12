import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createLicenseBatch } from "@/lib/app-data";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const formData = await request.formData();
  const count = Number(formData.get("count") ?? 1);
  await createLicenseBatch(count, admin.id);
  return NextResponse.redirect(new URL("/admin?generated=1", request.url));
}
