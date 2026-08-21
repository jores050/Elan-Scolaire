import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const submitRoute = await readFile(new URL("../src/app/api/app/submit-work/route.ts", import.meta.url), "utf8");
const statusRoute = await readFile(new URL("../src/app/api/app/diagnostic/[submissionId]/status/route.ts", import.meta.url), "utf8");
const retryRoute = await readFile(new URL("../src/app/api/app/diagnostic/[submissionId]/retry/route.ts", import.meta.url), "utf8");
const processingLib = await readFile(new URL("../src/lib/diagnostic-processing.ts", import.meta.url), "utf8");
const diagnosticPage = await readFile(new URL("../src/app/app/diagnostic/page.tsx", import.meta.url), "utf8");
const analysisPage = await readFile(new URL("../src/app/app/diagnostic/analyse/page.tsx", import.meta.url), "utf8");
const resultPage = await readFile(new URL("../src/app/app/diagnostic/resultat/page.tsx", import.meta.url), "utf8");
const elevePage = await readFile(new URL("../src/app/app/eleve/page.tsx", import.meta.url), "utf8");
const progressionPage = await readFile(new URL("../src/app/app/progression/page.tsx", import.meta.url), "utf8");

test("le diagnostic répond immédiatement et planifie le traitement en arrière-plan", () => {
  assert.match(submitRoute, /processingStatus: "pending"/);
  assert.match(submitRoute, /server_expected_context: expectedContext/);
  assert.match(submitRoute, /after\(async \(\) => \{\s*await processDiagnosticSubmission\(submission\.id\);/);
  assert.match(submitRoute, /\/app\/diagnostic\/analyse\?submission=\$\{submission\.id\}/);
});

test("le diagnostic expose les quatre statuts réels et une relance dédiée", () => {
  assert.match(statusRoute, /processingStatus/);
  assert.match(statusRoute, /validationStatus/);
  assert.match(statusRoute, /completed/);
  assert.match(retryRoute, /processingStatus: "pending"/);
  assert.match(retryRoute, /validationStatus: null/);
  assert.match(retryRoute, /processDiagnosticSubmission/);
});

test("le traitement de fond fige le plan avant de marquer completed", () => {
  assert.match(processingLib, /persistPretProgramSnapshotFromAnalysis/);
  assert.match(processingLib, /processingStatus: "completed"/);
  assert.match(processingLib, /processingStatus: "failed"/);
});

test("les trois écrans du diagnostic sont séparés", () => {
  assert.doesNotMatch(diagnosticPage, /Dernier résultat structuré/);
  assert.match(analysisPage, /DiagnosticAnalysisStatus/);
  assert.match(resultPage, /Programme personnalisé/);
});

test("l'UX préparation parle en séances et n'affiche pas NOT_DEFINED_IN_GUIDE", () => {
  assert.match(resultPage, /Séance \{day\.sessionIndex \?\? index \+ 1\} sur \{preparation\.totalDays\}/);
  assert.match(elevePage, /Séance \{sessionLabel\} sur \{journey\.preparation\.totalDays\}/);
  assert.match(progressionPage, /Séance \{day\.sessionIndex \?\? index \+ 1\}/);
  assert.doesNotMatch(resultPage, /NOT_DEFINED_IN_GUIDE/);
  assert.doesNotMatch(elevePage, /NOT_DEFINED_IN_GUIDE/);
});
