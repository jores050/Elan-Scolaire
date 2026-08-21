import assert from "node:assert/strict";
import test from "node:test";

const activationTokenModule = await import("../src/lib/activation-token.ts");

test("en production sans secret, la lecture du cookie d'activation échoue proprement", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousWebhookSecret = process.env.LICENSE_WEBHOOK_SECRET;
  const previousServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.NODE_ENV = "production";
  delete process.env.LICENSE_WEBHOOK_SECRET;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  assert.equal(activationTokenModule.readActivationToken("abc.def"), null);
  assert.throws(() => activationTokenModule.createActivationToken("ELAN-3E-DEMO-2026-0001"), /Activation token secret is missing/);

  process.env.NODE_ENV = previousNodeEnv;
  if (previousWebhookSecret == null) {
    delete process.env.LICENSE_WEBHOOK_SECRET;
  } else {
    process.env.LICENSE_WEBHOOK_SECRET = previousWebhookSecret;
  }
  if (previousServiceRole == null) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRole;
  }
});

test("le cookie Marketou signé est distinct de la clé d’activation manuelle", () => {
  const token = activationTokenModule.createMarketouAccessToken();
  assert.equal(activationTokenModule.hasValidMarketouAccess(token), true);
  assert.equal(activationTokenModule.readActivationToken(token), null);
  assert.deepEqual(activationTokenModule.readActivationContext(token), {
    kind: "marketou_access",
    source: "marketou",
    exp: activationTokenModule.readActivationContext(token).exp,
  });
});
