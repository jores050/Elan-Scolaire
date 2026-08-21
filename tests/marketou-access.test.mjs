import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const marketouModule = await import(pathToFileURL(path.join(root, "src/lib/marketou-access.ts")).href);
const activationPage = fs.readFileSync(path.join(root, "src/app/activation/page.tsx"), "utf8");
const registerRoute = fs.readFileSync(path.join(root, "src/app/api/auth/register/route.ts"), "utf8");
const loginRoute = fs.readFileSync(path.join(root, "src/app/api/auth/login/route.ts"), "utf8");
const finalizeRoute = fs.readFileSync(path.join(root, "src/app/api/auth/finalize/route.ts"), "utf8");
const marketouRoute = fs.readFileSync(path.join(root, "src/app/api/marketou/access/route.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260820220000_add_marketou_access_tracking.sql"), "utf8");
const appData = fs.readFileSync(path.join(root, "src/lib/app-data.ts"), "utf8");

test("la clé universelle Marketou est validée uniquement côté serveur", () => {
  const previousKey = process.env.MARKETOU_ACCESS_KEY;
  process.env.MARKETOU_ACCESS_KEY = "ELAN_MARKETOU_V1";

  assert.equal(marketouModule.isValidMarketouAccess({ source: "marketou", key: "ELAN_MARKETOU_V1" }), true);
  assert.equal(marketouModule.isValidMarketouAccess({ source: "marketou", key: "WRONG" }), false);
  assert.equal(marketouModule.isValidMarketouAccess({ source: "autre", key: "ELAN_MARKETOU_V1" }), false);

  if (previousKey == null) {
    delete process.env.MARKETOU_ACCESS_KEY;
  } else {
    process.env.MARKETOU_ACCESS_KEY = previousKey;
  }
});

test("la migration ajoute la traçabilité Marketou et l’index d’idempotence", () => {
  assert.match(migration, /add column if not exists signup_source text/i);
  assert.match(migration, /add column if not exists provision_source text/i);
  assert.match(migration, /add column if not exists provision_reference text/i);
  assert.match(migration, /create unique index if not exists idx_license_keys_marketou_user_unique/i);
});

test("l’activation Marketou bypass le formulaire manuel et propose les deux entrées", () => {
  assert.match(activationPage, /Bienvenue dans ÉLAN Scolaire/);
  assert.match(activationPage, /Créer mon compte/);
  assert.match(activationPage, /J’ai déjà un compte/);
  assert.match(marketouRoute, /createMarketouAccessToken/);
});

test("inscription et connexion délèguent le provisioning Marketou à la finalisation authentifiée", () => {
  assert.match(registerRoute, /readActivationContext/);
  assert.match(registerRoute, /\/api\/auth\/finalize/);
  assert.match(loginRoute, /\/api\/auth\/finalize/);
  assert.match(finalizeRoute, /finalizeAuthenticatedUser/);
  assert.match(appData, /provisionMarketouAccessForUser/);
});

test("le provisioning Marketou reste individuel et idempotent", () => {
  assert.match(appData, /provision_source: MARKETOU_PROVISION_SOURCE/);
  assert.match(appData, /provision_reference: userId/);
  assert.match(appData, /product: MARKETOU_PRODUCT/);
  assert.match(appData, /license_duration_days: 365/);
  assert.match(appData, /max_students: MARKETOU_MAX_STUDENTS/);
  assert.match(appData, /reason: "existing_premium"/);
  assert.match(appData, /reason: "existing_marketou"/);
});
