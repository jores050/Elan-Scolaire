import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const analysisLib = await readFile(new URL("../src/lib/analysis.ts", import.meta.url), "utf8");
const practiceProcessing = await readFile(new URL("../src/lib/practice-processing.ts", import.meta.url), "utf8");
const diagnosticProcessing = await readFile(new URL("../src/lib/diagnostic-processing.ts", import.meta.url), "utf8");

test("CAS F — la pratique reste corrigée par notion et peut isoler priorites_operatoires", () => {
  assert.match(analysisLib, /const references = parsed\.references\.filter\(\(item\) => item\.topic_slug === topicSlug\);/);
  assert.match(analysisLib, /const fallbackMastery = references\.some\(\(item\) => item\.result === "incorrect"\)/);
  assert.match(analysisLib, /lesson_ai: mastery === "maitrise" \? null : normalized\.lesson_ai/);
});

test("CAS G — une référence serveur manquante bloque la progression au lieu d'utiliser un fallback incohérent", () => {
  assert.match(practiceProcessing, /REFERENCE_NOT_FOUND: la référence pédagogique attendue n'existe pas dans le référentiel officiel/);
  assert.match(diagnosticProcessing, /REFERENCE_NOT_FOUND: le diagnostic attendu n'a pas été retrouvé dans le référentiel officiel/);
});
