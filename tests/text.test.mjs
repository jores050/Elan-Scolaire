import assert from "node:assert/strict";
import test from "node:test";
import { repairMojibake } from "../src/lib/text.ts";

test("répare un ancien texte UTF-8 interprété comme latin-1", () => {
  assert.equal(repairMojibake("rÃ©ponse Ã  l'exercice 3 × 5"), "réponse à l'exercice 3 × 5");
});

test("conserve un texte français déjà valide", () => {
  assert.equal(repairMojibake("Très bon travail"), "Très bon travail");
});
