import { NextResponse } from "next/server";
import { LICENSE_WEBHOOK_SECRET } from "@/lib/config";
import { createLicenseBatch } from "@/lib/app-data";

export async function POST(request: Request) {
  const payload = (await request.json()) as { secret?: string; order_reference?: string; product?: string };
  if (payload.secret !== LICENSE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const [license] = await createLicenseBatch(1);
  return NextResponse.json({
    order_reference: payload.order_reference ?? null,
    product: license.product,
    license_suffix: license.key_suffix,
    license_code: license.plainText,
  });
}
