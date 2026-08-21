import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolveActiveStudent } from "../src/lib/active-student-core.ts";
import { buildNextStepSummary, selectActiveExamPlan, selectRecommendedSession } from "../src/lib/annual-recommendation.ts";

function makeWeek(overrides = {}) {
  return {
    id: overrides.id ?? `week-${Math.random()}`,
    week_number: overrides.week_number ?? 1,
    title: overrides.title ?? "Fractions",
    objective: overrides.objective ?? null,
    status: overrides.status ?? "not_started",
    topic_slug: overrides.topic_slug ?? "fractions",
    topic_name: overrides.topic_name ?? "Fractions",
    guide_reference: Object.prototype.hasOwnProperty.call(overrides, "guide_reference") ? overrides.guide_reference : "Guide 2",
    page_reference: Object.prototype.hasOwnProperty.call(overrides, "page_reference") ? overrides.page_reference : "Pages 18-19",
    estimated_minutes: overrides.estimated_minutes ?? 25,
    items: overrides.items ?? [{
      id: "item-1",
      item_type: "exercise",
      title: "Exercices de fractions",
      status: "not_started",
      estimated_minutes: 25,
      guide_reference: "Guide 2",
      page_reference: "Pages 18-19",
      exercise_reference: "Guide 2 · Pages 18-19 · exercices 1 à 4",
    }],
  };
}

test("chapitre actuel fragile -> priorité au chapitre en cours", () => {
  const recommendation = selectRecommendedSession({
    today: "2026-08-20",
    currentTopicSlug: "fractions",
    progress: [{ topic_slug: "fractions", score: 32, mastery: "a_reprendre" }],
    weeks: [makeWeek()],
    activeExamPlan: null,
    lessonAiByTopic: new Map(),
  });

  assert.equal(recommendation?.topic_slug, "fractions");
  assert.match(recommendation?.reason ?? "", /actuellement étudiée en classe/i);
});

test("chapitre actuel maîtrisé -> priorité à un prérequis fragile", () => {
  const recommendation = selectRecommendedSession({
    today: "2026-08-20",
    currentTopicSlug: "equations",
    progress: [
      { topic_slug: "equations", score: 88, mastery: "maitrise" },
      { topic_slug: "fractions", score: 36, mastery: "a_reprendre" },
    ],
    weeks: [
      makeWeek({ week_number: 4, topic_slug: "equations", topic_name: "Équations", title: "Équations" }),
      makeWeek({ id: "week-2", week_number: 2, topic_slug: "fractions", topic_name: "Fractions", title: "Fractions" }),
    ],
    activeExamPlan: null,
    lessonAiByTopic: new Map(),
  });

  assert.equal(recommendation?.topic_slug, "fractions");
  assert.match(recommendation?.reason ?? "", /Prérequis nécessaire/i);
});

test("devoir proche -> plan temporaire prioritaire", () => {
  const activePlan = selectActiveExamPlan([
    {
      id: "plan-1",
      exam_date: "2026-08-22",
      study_plan_items: [
        { day_label: "Aujourd’hui", topic: "Fractions", topic_slug: "fractions", reference_label: "30 min · Guide 2 · Pages 18-19 · exercices 1 à 4" },
      ],
    },
  ], "2026-08-20");

  const recommendation = selectRecommendedSession({
    today: "2026-08-20",
    currentTopicSlug: "equations",
    progress: [],
    weeks: [makeWeek({ topic_slug: "equations", title: "Équations" })],
    activeExamPlan: activePlan,
    lessonAiByTopic: new Map(),
  });

  assert.equal(recommendation?.source, "exam_prep");
  assert.match(recommendation?.reason ?? "", /devoir est prévu/i);
});

test("fin du devoir -> retour au parcours annuel", () => {
  const activePlan = selectActiveExamPlan([
    {
      id: "plan-1",
      exam_date: "2026-08-19",
      study_plan_items: [
        { day_label: "Aujourd’hui", topic: "Fractions", topic_slug: "fractions", reference_label: "30 min · Guide 2 · Pages 18-19 · exercices 1 à 4" },
      ],
    },
  ], "2026-08-20");

  const recommendation = selectRecommendedSession({
    today: "2026-08-20",
    currentTopicSlug: "fractions",
    progress: [{ topic_slug: "fractions", score: 40, mastery: "a_reprendre" }],
    weeks: [makeWeek()],
    activeExamPlan: activePlan,
    lessonAiByTopic: new Map(),
  });

  assert.equal(activePlan, null);
  assert.equal(recommendation?.source, "annual");
});

test("guide incomplet -> aucune référence inventée", () => {
  const recommendation = selectRecommendedSession({
    today: "2026-08-20",
    currentTopicSlug: "fractions",
    progress: [{ topic_slug: "fractions", score: 40, mastery: "a_reprendre" }],
    weeks: [makeWeek({
      guide_reference: null,
      page_reference: null,
      title: "Fractions",
      items: [{
        id: "item-1",
        item_type: "exercise",
        title: "Exercices de fractions",
        status: "not_started",
        estimated_minutes: 25,
        guide_reference: null,
        page_reference: null,
        exercise_reference: null,
      }],
    })],
    activeExamPlan: null,
    lessonAiByTopic: new Map(),
  });

  assert.equal(recommendation?.reference_label, "Référence du guide en cours de préparation");
});

test("multi-élèves -> la sélection persistante respecte l’élève demandé", () => {
  const students = [
    { id: "student-a", first_name: "A", level: "3e" },
    { id: "student-b", first_name: "B", level: "3e" },
  ];

  assert.equal(resolveActiveStudent(students, "student-b")?.id, "student-b");
  assert.equal(resolveActiveStudent(students, "missing")?.id, "student-a");
});

test("prochaine étape devoir -> retour annuel explicite", () => {
  const summary = buildNextStepSummary({
    activeExamPlan: {
      id: "plan-1",
      exam_date: "2026-08-22",
      days_until_exam: 2,
      items: [],
      current_item: null,
    },
    recommendedSession: null,
    currentWeek: null,
  });

  assert.match(summary, /reprendra automatiquement le parcours annuel/i);
});

test("le scan annuel utilise le topic recommandé et le contexte officiel", async () => {
  const submitRoute = await readFile(new URL("../src/app/api/app/submit-work/route.ts", import.meta.url), "utf8");
  const practiceProcessing = await readFile(new URL("../src/lib/practice-processing.ts", import.meta.url), "utf8");
  assert.match(submitRoute, /buildExpectedSubmissionContext/);
  assert.match(submitRoute, /server_expected_context: expectedContext/);
  assert.match(practiceProcessing, /persistProgress: expectedContext\.progression_eligible/);
});
