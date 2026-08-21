import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const loginRoute = await readFile(new URL("../src/app/api/auth/login/route.ts", import.meta.url), "utf8");
const loginPage = await readFile(new URL("../src/app/connexion/page.tsx", import.meta.url), "utf8");
const registerRoute = await readFile(new URL("../src/app/api/auth/register/route.ts", import.meta.url), "utf8");
const finalizeRoute = await readFile(new URL("../src/app/api/auth/finalize/route.ts", import.meta.url), "utf8");
const finalizeHelpers = await readFile(new URL("../src/lib/auth-finalize.ts", import.meta.url), "utf8");
const signupPage = await readFile(new URL("../src/app/inscription/page.tsx", import.meta.url), "utf8");

test("la connexion redirige en GET après le POST", () => {
  assert.match(loginRoute, /NextResponse\.redirect\(new URL\("\/api\/auth\/finalize", request\.url\), 303\)/);
});

test("une panne Supabase n’est pas présentée comme un mauvais mot de passe", () => {
  assert.match(loginRoute, /invalidCredentials \? "invalid" : "service"/);
  assert.match(loginPage, /Connexion temporairement indisponible/);
});

test("Marketou signup avec session immédiate délègue la finalisation produit à une route dédiée", () => {
  assert.match(registerRoute, /if \(!data\.session\)/);
  assert.match(registerRoute, /NextResponse\.redirect\(new URL\("\/api\/auth\/finalize", request\.url\), 303\)/);
  assert.match(finalizeRoute, /finalizeAuthenticatedUser/);
});

test("Marketou signup sans session affiche un état confirmation email clair", () => {
  assert.match(registerRoute, /NextResponse\.redirect\(new URL\("\/inscription\?status=confirm-email"/);
  assert.match(signupPage, /Votre compte a été créé/);
  assert.match(signupPage, /Nous vous avons envoyé un email de confirmation/);
});

test("un compte déjà existant renvoie vers connexion avec un message explicite", () => {
  assert.match(registerRoute, /connexion\?error=already_exists/);
  assert.match(loginPage, /Un compte existe déjà avec cette adresse/);
});

test("une erreur de signup invalide reste sur inscription avec un message dédié", () => {
  assert.match(finalizeHelpers, /inscription\?error=invalid_email/);
  assert.match(registerRoute, /inscription\?error=weak_password/);
  assert.match(signupPage, /L’adresse email saisie n’est pas valide/);
  assert.match(signupPage, /Le mot de passe doit contenir au moins 8 caractères/);
});

test("la finalisation centralise le provisioning et la destination post-auth", () => {
  assert.match(finalizeRoute, /if \(!user\)/);
  assert.match(finalizeRoute, /activationContextPresent/);
  assert.match(finalizeRoute, /response\.cookies\.delete\(ACTIVATION_COOKIE\)/);
});
