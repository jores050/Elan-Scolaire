import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { LICENSE_WEBHOOK_SECRET } from "@/lib/config";
import { createLicenseBatch } from "@/lib/app-data";

function secretsMatch(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (!LICENSE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const payload = (await request.json()) as { secret?: string; order_reference?: string; product?: string };
  if (typeof payload.secret !== "string" || !secretsMatch(payload.secret, LICENSE_WEBHOOK_SECRET)) {
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
