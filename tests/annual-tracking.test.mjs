import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { computeWeekStatus, shouldTransitionToAnnual } from "../src/lib/annual-rules.ts";

const migration = await readFile(new URL("../supabase/migrations/20260813130000_add_annual_tracking_architecture.sql", import.meta.url), "utf8");
const homepage = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const submissionRoute = await readFile(new URL("../src/app/api/app/submit-work/route.ts", import.meta.url), "utf8");

test("la transition ne se déclenche qu’après 14 jours et une seule fois", () => {
  assert.equal(shouldTransitionToAnnual(13, 14, false), false);
  assert.equal(shouldTransitionToAnnual(14, 14, false), true);
  assert.equal(shouldTransitionToAnnual(14, 14, true), false);
});

test("la progression hebdomadaire ne termine pas une semaine après un seul item", () => {
  assert.equal(computeWeekStatus(["completed", "not_started"]), "in_progress");
  assert.equal(computeWeekStatus(["completed", "completed"]), "completed");
  assert.equal(computeWeekStatus(["completed", "needs_review"]), "needs_review");
  assert.equal(computeWeekStatus([]), "not_started");
});

test("la migration rend l’enrollment idempotent et active RLS", () => {
  assert.match(migration, /unique \(student_id, annual_program_id\)/i);
  assert.match(migration, /on conflict \(student_id, annual_program_id\)/i);
  assert.match(migration, /alter table public\.student_week_progress enable row level security/i);
  assert.match(migration, /s\.parent_user_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /transition_day14_to_annual/i);
});

test("une soumission peut cibler la phase annuelle sans retirer la phase 14 jours", () => {
  assert.match(submissionRoute, /programDayId/);
  assert.match(submissionRoute, /programItemId/);
  assert.match(submissionRoute, /annualWeekId/);
  assert.match(submissionRoute, /annualWeekItemId/);
});

test("l’envoi redirige en GET après le POST multipart", () => {
  assert.match(submissionRoute, /successResponse\(`\/app\/travaux\/analyse\?submission=\$\{submission\.id\}`\)/);
  assert.match(submissionRoute, /NextResponse\.redirect\(new URL\(path, request\.url\), 303\)/);
  assert.doesNotMatch(submissionRoute, /travaux\?uploaded=1", request\.url\)\);/);
});

test("la homepage présente le parcours complet et la démo intégrée", () => {
  assert.match(homepage, /Aidez votre enfant à réussir les maths en 3e/);
  assert.match(homepage, /35 épreuves réelles de 3e et du BEPC/);
  assert.match(homepage, /Apprendre la 3e/);
  assert.match(homepage, /Payez en un clic/);
  assert.match(homepage, /GuidePreview/);
  assert.match(homepage, /LandingDemo/);
});
