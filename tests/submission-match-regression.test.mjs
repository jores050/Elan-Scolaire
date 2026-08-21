import assert from "node:assert/strict";
import test from "node:test";
import { validateSubmissionMatch } from "../src/lib/submission-match.ts";

process.env.AI_PROVIDER = "mock";

function makeFile(name = "copie.jpg") {
  return {
    name,
    type: "image/jpeg",
    size: 128,
    async arrayBuffer() {
      return new Uint8Array([1, 2, 3]).buffer;
    },
  };
}

function makeProgramDayContext() {
  return {
    submission_kind: "practice",
    student_id: "student-1",
    context_type: "pret_program",
    reference_lookup_status: "ok",
    expected_document_type: "PROGRAM_DAY",
    guide_code: "guide-1-diagnostic-passerelle-3e-v2",
    expected_topic_slugs: ["relatifs_signes", "priorites_operatoires"],
    guide_reference: "Guide 1 V2 - Diagnostic & Passerelle vers la 3e",
    page_reference: "Pages 4-5",
    day_reference: "J1",
    exercise_references: ["Exercices 1 à 4"],
    exercise_numbers: ["1", "2", "3", "4"],
    expected_reference_ids: ["J1-L1-1", "J1-L1-2", "J1-L1-3", "J1-L1-4"],
    section_code: "JE_MONTE_AU_NIVEAU_FIN_DE_4E",
    section_label: "3 - JE MONTE AU NIVEAU FIN DE 4e",
    level_code: "NIVEAU_1",
    level_label: "Niveau 1 - Réactivation",
    expected_items: [
      { reference_id: "J1-L1-1", document_type: "PROGRAM_DAY", day_number: 1, section_code: "JE_MONTE_AU_NIVEAU_FIN_DE_4E", section_label: "3 - JE MONTE AU NIVEAU FIN DE 4e", level_code: "NIVEAU_1", level_label: "Niveau 1 - Réactivation", exercise_number: "1", item_type: "EXERCISE", prompt_text: "-7+12-9", topic_slug: "relatifs_signes", skill_tested: null, expected_answer: "-4", accepted_answers: ["-4"], scoring_rules: {}, common_errors: [], correction_ref: "Pages 4-5", answer_status: "DETERMINISTIC", page_reference: "Pages 4-5" },
      { reference_id: "J1-L1-2", document_type: "PROGRAM_DAY", day_number: 1, section_code: "JE_MONTE_AU_NIVEAU_FIN_DE_4E", section_label: "3 - JE MONTE AU NIVEAU FIN DE 4e", level_code: "NIVEAU_1", level_label: "Niveau 1 - Réactivation", exercise_number: "2", item_type: "EXERCISE", prompt_text: "(-6)×(-4)÷3", topic_slug: "relatifs_signes", skill_tested: null, expected_answer: "8", accepted_answers: ["8"], scoring_rules: {}, common_errors: [], correction_ref: "Pages 4-5", answer_status: "DETERMINISTIC", page_reference: "Pages 4-5" },
      { reference_id: "J1-L1-3", document_type: "PROGRAM_DAY", day_number: 1, section_code: "JE_MONTE_AU_NIVEAU_FIN_DE_4E", section_label: "3 - JE MONTE AU NIVEAU FIN DE 4e", level_code: "NIVEAU_1", level_label: "Niveau 1 - Réactivation", exercise_number: "3", item_type: "EXERCISE", prompt_text: "18-3×(2+4)", topic_slug: "priorites_operatoires", skill_tested: null, expected_answer: "0", accepted_answers: ["0"], scoring_rules: {}, common_errors: [], correction_ref: "Pages 4-5", answer_status: "DETERMINISTIC", page_reference: "Pages 4-5" },
      { reference_id: "J1-L1-4", document_type: "PROGRAM_DAY", day_number: 1, section_code: "JE_MONTE_AU_NIVEAU_FIN_DE_4E", section_label: "3 - JE MONTE AU NIVEAU FIN DE 4e", level_code: "NIVEAU_1", level_label: "Niveau 1 - Réactivation", exercise_number: "4", item_type: "EXERCISE", prompt_text: "-5-(-8)", topic_slug: "relatifs_signes", skill_tested: null, expected_answer: "3", accepted_answers: ["3"], scoring_rules: {}, common_errors: [], correction_ref: "Pages 4-5", answer_status: "DETERMINISTIC", page_reference: "Pages 4-5" },
    ],
    title: "Jour 1",
    day_title: "Calcul numérique",
    day_number: 1,
    program_day_id: "day-1",
    program_item_id: "item-1",
    annual_week_id: null,
    annual_week_item_id: null,
    progression_eligible: true,
    pedagogical_prompt: "Séance J1 niveau 1.",
  };
}

test("CAS A — J1 niveau 1 ex 1-4 exact => MATCH", async () => {
  const result = await validateSubmissionMatch({
    expectedContext: makeProgramDayContext(),
    files: [makeFile()],
    comment: "J1-L1-1 J1-L1-2 J1-L1-3 J1-L1-4 1 2 3 4",
    fileNames: ["j1-niveau1.jpg"],
  });
  assert.equal(result.submissionStatus, "MATCH");
});

test("CAS B — diagnostic envoyé à la place de J1 => MISMATCH", async () => {
  const result = await validateSubmissionMatch({
    expectedContext: makeProgramDayContext(),
    files: [makeFile()],
    comment: "Diagnostic DIAG-01 DIAG-02 DIAG-03 DIAG-04 DIAG-05",
    fileNames: ["diagnostic.jpg"],
  });
  assert.equal(result.submissionStatus, "MISMATCH");
  assert.equal(result.detectedDocumentType, "DIAGNOSTIC");
});

test("CAS C — photo illisible => UNREADABLE", async () => {
  const result = await validateSubmissionMatch({
    expectedContext: makeProgramDayContext(),
    files: [makeFile()],
    comment: "copie illisible blurry unreadable",
    fileNames: ["illisible.jpg"],
  });
  assert.equal(result.submissionStatus, "UNREADABLE");
});

test("CAS D — seulement ex 1-2 visibles => PARTIAL_MATCH", async () => {
  const result = await validateSubmissionMatch({
    expectedContext: makeProgramDayContext(),
    files: [makeFile()],
    comment: "partial 1 2 J1-L1-1 J1-L1-2",
    fileNames: ["partiel.jpg"],
  });
  assert.equal(result.submissionStatus, "PARTIAL_MATCH");
});

test("CAS E — bonnes références mais réponses mathématiquement fausses => MATCH", async () => {
  const result = await validateSubmissionMatch({
    expectedContext: makeProgramDayContext(),
    files: [makeFile()],
    comment: "J1-L1-1 J1-L1-2 J1-L1-3 J1-L1-4 1 2 3 4 réponses fausses",
    fileNames: ["j1-erreurs.jpg"],
  });
  assert.equal(result.submissionStatus, "MATCH");
  assert.equal(result.detectedDocumentType, "PROGRAM_DAY");
});
