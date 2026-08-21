import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

test("la durée du programme personnalisé reste bornée par les vrais jours retenus", async () => {
  const { buildPersonalizedRevisionPlan } = await import(pathToFileURL(path.join(root, "src/lib/revision-plan.ts")).href);

  const days = Array.from({ length: 14 }, (_, index) => ({
    id: `day-${index + 1}`,
    day_number: index + 1,
    title: `Jour ${index + 1}`,
    objective: null,
    estimated_minutes_min: 20,
    estimated_minutes_max: 30,
    metadata: { topic_slugs: [`topic-${index + 1}`], guide_label: "Guide", page_reference: null },
    items: [{ item_type: "exercise", item_order: 1, title: "Exercice 1" }],
  }));

  const plan = buildPersonalizedRevisionPlan(days, [
    { topicSlug: "topic-1", mastery: "a_reprendre", score: 20, evidenceCount: 2, correctCount: 0, partialCount: 0, incorrectCount: 2, confidence: "high", evidence: [], referenceIds: [], recommendedDayNumbers: [1] },
    { topicSlug: "topic-2", mastery: "a_reprendre", score: 25, evidenceCount: 2, correctCount: 0, partialCount: 0, incorrectCount: 2, confidence: "high", evidence: [], referenceIds: [], recommendedDayNumbers: [2] },
    { topicSlug: "topic-3", mastery: "a_renforcer", score: 55, evidenceCount: 1, correctCount: 0, partialCount: 1, incorrectCount: 0, confidence: "medium", evidence: [], referenceIds: [], recommendedDayNumbers: [3] },
  ]);

  assert.equal(plan.weightedNeeds, 5);
  assert.equal(plan.targetDays, 4);
  assert.deepEqual(plan.selectedDayNumbers, [1, 2, 3, 14]);
});

test("la durée du programme ne descend pas sous le nombre de jours indispensables", async () => {
  const { buildPersonalizedRevisionPlan } = await import(pathToFileURL(path.join(root, "src/lib/revision-plan.ts")).href);

  const days = Array.from({ length: 14 }, (_, index) => ({
    id: `day-${index + 1}`,
    day_number: index + 1,
    title: `Jour ${index + 1}`,
    objective: null,
    estimated_minutes_min: 20,
    estimated_minutes_max: 30,
    metadata: { topic_slugs: [`topic-${index + 1}`], guide_label: "Guide", page_reference: null },
    items: [{ item_type: "exercise", item_order: 1, title: "Exercice 1" }],
  }));

  const plan = buildPersonalizedRevisionPlan(days, [
    {
      topicSlug: "topic-2",
      mastery: "a_renforcer",
      score: 55,
      evidenceCount: 1,
      correctCount: 0,
      partialCount: 1,
      incorrectCount: 0,
      confidence: "medium",
      evidence: [],
      referenceIds: [],
      recommendedDayNumbers: [2],
      guideRoute: { day_number: 2, day_title: "Jour 2", guide_title: "Guide", page_reference: "Pages 6-7", primary_part: "Je reactive", primary_level: "Niveau 1", mini_test_ref: "T1-T5" },
    },
    {
      topicSlug: "topic-5",
      mastery: "a_renforcer",
      score: 58,
      evidenceCount: 1,
      correctCount: 0,
      partialCount: 1,
      incorrectCount: 0,
      confidence: "medium",
      evidence: [],
      referenceIds: [],
      recommendedDayNumbers: [5],
      guideRoute: { day_number: 5, day_title: "Jour 5", guide_title: "Guide", page_reference: "Pages 12-13", primary_part: "Je reactive", primary_level: "Niveau 1", mini_test_ref: "T1-T5" },
    },
    {
      topicSlug: "topic-8",
      mastery: "a_renforcer",
      score: 59,
      evidenceCount: 1,
      correctCount: 0,
      partialCount: 1,
      incorrectCount: 0,
      confidence: "medium",
      evidence: [],
      referenceIds: [],
      recommendedDayNumbers: [8],
      guideRoute: { day_number: 8, day_title: "Jour 8", guide_title: "Guide", page_reference: "Pages 18-19", primary_part: "Je reactive", primary_level: "Niveau 1", mini_test_ref: "T1-T5" },
    },
    {
      topicSlug: "topic-11",
      mastery: "a_renforcer",
      score: 57,
      evidenceCount: 1,
      correctCount: 0,
      partialCount: 1,
      incorrectCount: 0,
      confidence: "medium",
      evidence: [],
      referenceIds: [],
      recommendedDayNumbers: [11],
      guideRoute: { day_number: 11, day_title: "Jour 11", guide_title: "Guide", page_reference: "Pages 24-25", primary_part: "Je reactive", primary_level: "Niveau 1", mini_test_ref: "T1-T5" },
    },
  ]);

  assert.equal(plan.weightedNeeds, 4);
  assert.equal(plan.indispensableDayCount, 4);
  assert.equal(plan.targetDays, 5);
  assert.deepEqual(plan.selectedDayNumbers, [2, 5, 8, 11, 14]);
});

test("le plan personnalisé inclut toujours le test final comme dernière étape quand il est disponible", async () => {
  const { buildPersonalizedRevisionPlan } = await import(pathToFileURL(path.join(root, "src/lib/revision-plan.ts")).href);

  const days = Array.from({ length: 14 }, (_, index) => ({
    id: `day-${index + 1}`,
    day_number: index + 1,
    title: `Jour ${index + 1}`,
    objective: null,
    estimated_minutes_min: 20,
    estimated_minutes_max: 30,
    metadata: { topic_slugs: index < 4 ? ["polynomes"] : ["statistique"], guide_label: "Guide", page_reference: null },
    items: [{ item_type: "exercise", item_order: 1, title: "Exercice 1" }],
  }));

  const plan = buildPersonalizedRevisionPlan(days, [
    { topicSlug: "polynomes", mastery: "a_reprendre", score: 30, evidenceCount: 2, correctCount: 0, partialCount: 0, incorrectCount: 2, confidence: "high", evidence: [], referenceIds: [], recommendedDayNumbers: [3, 4] },
  ]);

  assert.equal(plan.selectedDays.at(-1)?.dayNumber, 14);
});

test("une notion maîtrisée n'ajoute aucune séance artificielle", async () => {
  const { buildPersonalizedRevisionPlan } = await import(pathToFileURL(path.join(root, "src/lib/revision-plan.ts")).href);

  const days = Array.from({ length: 14 }, (_, index) => ({
    id: `day-${index + 1}`,
    day_number: index + 1,
    title: `Jour ${index + 1}`,
    objective: null,
    estimated_minutes_min: 20,
    estimated_minutes_max: 30,
    metadata: { topic_slugs: index === 0 ? ["relatifs_signes"] : index === 4 ? ["developpement"] : ["priorites_operatoires"], guide_label: "Guide", page_reference: null },
    items: [{ item_type: "exercise", item_order: 1, title: "Exercice 1" }],
  }));

  const plan = buildPersonalizedRevisionPlan(days, [
    {
      topicSlug: "developpement",
      mastery: "maitrise",
      score: 100,
      evidenceCount: 1,
      correctCount: 1,
      partialCount: 0,
      incorrectCount: 0,
      confidence: "high",
      evidence: [],
      referenceIds: [],
      recommendedDayNumbers: [5],
      guideRoute: { day_number: 5, day_title: "Jour 5", guide_title: "Guide", page_reference: "Pages 12-13", primary_part: "Je reactive", primary_level: "Niveau 1", mini_test_ref: "T1-T5" },
    },
    {
      topicSlug: "priorites_operatoires",
      mastery: "maitrise",
      score: 100,
      evidenceCount: 1,
      correctCount: 1,
      partialCount: 0,
      incorrectCount: 0,
      confidence: "high",
      evidence: [],
      referenceIds: [],
      recommendedDayNumbers: [3],
      guideRoute: { day_number: 3, day_title: "Jour 3", guide_title: "Guide", page_reference: "Pages 8-9", primary_part: "Je reactive", primary_level: "Niveau 1", mini_test_ref: "T1-T5" },
    },
    {
      topicSlug: "relatifs_signes",
      mastery: "a_reprendre",
      score: 60,
      evidenceCount: 2,
      correctCount: 0,
      partialCount: 2,
      incorrectCount: 0,
      confidence: "medium",
      evidence: [],
      referenceIds: [],
      recommendedDayNumbers: [1],
      guideRoute: { day_number: 1, day_title: "Jour 1", guide_title: "Guide", page_reference: "Pages 4-5", primary_part: "Je reactive", primary_level: "Niveau 1", mini_test_ref: "T1-T5" },
    },
  ]);

  assert.equal(plan.targetDays, 2);
  assert.deepEqual(plan.selectedDayNumbers, [1, 14]);
  assert.deepEqual(plan.focusTopicSlugs, ["relatifs_signes"]);
});

test("le programme affiche les vraies plages d'exercices du guide 14 jours quand le referentiel les fournit", async () => {
  const { buildPersonalizedRevisionPlan } = await import(pathToFileURL(path.join(root, "src/lib/revision-plan.ts")).href);

  const days = Array.from({ length: 14 }, (_, index) => ({
    id: `day-${index + 1}`,
    day_number: index + 1,
    title: `Jour ${index + 1}`,
    objective: null,
    estimated_minutes_min: 20,
    estimated_minutes_max: 30,
    metadata: { topic_slugs: index === 0 ? ["relatifs_signes"] : ["topic-autre"], guide_label: "Guide", page_reference: null },
    items: [{ item_type: "exercise", item_order: 99, title: "Exercice hors referentiel" }],
  }));

  const plan = buildPersonalizedRevisionPlan(days, [
    {
      topicSlug: "relatifs_signes",
      mastery: "a_reprendre",
      score: 20,
      evidenceCount: 2,
      correctCount: 0,
      partialCount: 0,
      incorrectCount: 2,
      confidence: "high",
      evidence: [],
      referenceIds: [],
      recommendedDayNumbers: [1],
    },
  ]);

  assert.equal(plan.selectedDays[0]?.dayNumber, 1);
  assert.equal(plan.selectedDays[0]?.guideLabel, "Guide 1 V2 - Diagnostic & Passerelle vers la 3e");
  assert.equal(plan.selectedDays[0]?.exerciseNumbers, "Exercices 1 a 3");
  assert.equal(plan.selectedDays[0]?.recommendedPart, "Je reactive");
  assert.equal(plan.selectedDays[0]?.recommendedLevel, "NOT_DEFINED_IN_GUIDE");
});
