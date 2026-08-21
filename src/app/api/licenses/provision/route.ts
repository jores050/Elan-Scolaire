import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { LICENSE_WEBHOOK_SECRET } from "@/lib/config";
import { createLicenseBatch, getProvisionedLicenseByOrderReference } from "@/lib/app-data";

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

  const payload = (await request.json()) as {
    secret?: string;
    order_reference?: string;
    product?: string;
    email?: string;
    purchase_date?: string;
    license_duration?: number;
    max_students?: number;
  };
  if (typeof payload.secret !== "string" || !secretsMatch(payload.secret, LICENSE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const orderReference = payload.order_reference?.trim() || null;
  if (orderReference) {
    const existing = await getProvisionedLicenseByOrderReference(orderReference);
    if (existing) {
      return NextResponse.json({
        already_provisioned: true,
        order_reference: existing.order_reference,
        product: existing.product,
        license_suffix: existing.key_suffix,
        license_code: null,
      });
    }
  }

  let license;
  try {
    [license] = await createLicenseBatch(1, {
      orderReference,
      product: payload.product ?? null,
      maxStudents: payload.max_students ?? null,
      durationDays: payload.license_duration ?? null,
    });
  } catch (error) {
    const duplicateProvision = typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "23505";
    if (!duplicateProvision || !orderReference) throw error;
    const existing = await getProvisionedLicenseByOrderReference(orderReference);
    if (!existing) throw error;
    return NextResponse.json({
      already_provisioned: true,
      order_reference: existing.order_reference,
      product: existing.product,
      license_suffix: existing.key_suffix,
      license_code: null,
    });
  }

  return NextResponse.json({
    already_provisioned: false,
    order_reference: orderReference,
    product: license.product,
    license_suffix: license.key_suffix,
    license_code: license.plainText,
  });
}
