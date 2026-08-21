import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createLicenseBatch } from "@/lib/app-data";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const formData = await request.formData();
  const count = Number(formData.get("count") ?? 1);
  const licenses = await createLicenseBatch(count, admin.id);
  const search = new URLSearchParams();
  search.set("keys", licenses.map((license) => license.plainText).join("\n"));
  return NextResponse.redirect(new URL(`/admin/licenses/generated?${search.toString()}`, request.url));
}
