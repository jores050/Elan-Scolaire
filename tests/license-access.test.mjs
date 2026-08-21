import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

test("une licence active expire 365 jours après activation par défaut", async () => {
  const { computeLicenseExpiry } = await import(pathToFileURL(path.join(root, "src/lib/licenses.ts")).href);
  const activationDate = new Date("2026-08-20T10:00:00.000Z");
  const expiresAt = computeLicenseExpiry(activationDate, 365);
  assert.equal(expiresAt.toISOString(), "2027-08-20T10:00:00.000Z");
});

test("une licence premium n'est valide que si elle est active et non expirée", async () => {
  const { isLicenseCurrentlyValid } = await import(pathToFileURL(path.join(root, "src/lib/licenses.ts")).href);
  assert.equal(isLicenseCurrentlyValid({ status: "active", expires_at: "2026-08-21T00:00:00.000Z" }, new Date("2026-08-20T00:00:00.000Z")), true);
  assert.equal(isLicenseCurrentlyValid({ status: "active", expires_at: "2026-08-20T00:00:00.000Z" }, new Date("2026-08-20T00:00:00.000Z")), false);
  assert.equal(isLicenseCurrentlyValid({ status: "available", expires_at: "2026-09-20T00:00:00.000Z" }, new Date("2026-08-20T00:00:00.000Z")), false);
});

test("la migration rend le provisioning idempotent et impose la capacité élève", () => {
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260820110000_harden_license_access.sql"), "utf8");
  assert.match(migration, /create unique index if not exists idx_license_keys_order_reference_unique/i);
  assert.match(migration, /create or replace function public\.enforce_student_capacity/i);
  assert.match(migration, /current_user_has_premium_access/i);
  assert.match(migration, /expires_at = now\(\) \+ make_interval\(days => license_duration_days\)/i);
});
