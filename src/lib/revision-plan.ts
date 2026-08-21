import { bridgeFinalTestReference, getGuideRecommendation, type ControlledDepth } from "./diagnostic-referential.ts";
import type { TopicDiagnosticResult } from "./diagnostic-evaluation.ts";

export type RevisionPlanTopicResult = TopicDiagnosticResult & {
  depth?: ControlledDepth;
  guideRoute?: {
    day_number?: number;
    day_title?: string;
    guide_title?: string;
    page_reference?: string;
    primary_part?: string;
    primary_level?: string;
    mini_test_ref?: string;
  } | null;
  lessonAi?: {
    title: string;
    duration_minutes: number;
    explanation: string;
    examples: string[];
  } | null;
  followUpQuestions?: Array<{ topic_slug: string; question: string }>;
};

export type RevisionPlanDay = {
  dayId: string;
  dayNumber: number;
  title: string;
  objective: string | null;
  guideLabel: string;
  pageReference: string | null;
  exerciseNumbers: string;
  estimatedMinutes: number;
  priority: "a_reprendre" | "a_renforcer" | "maitrise";
  topicSlugs: string[];
  recommendedPart: string;
  recommendedLevel: string;
  lessonAi: RevisionPlanTopicResult["lessonAi"];
  followUpQuestions: RevisionPlanTopicResult["followUpQuestions"];
  isFinalValidation: boolean;
};

export type RevisionPlan = {
  targetDays: number;
  weightedNeeds: number;
  indispensableDayCount: number;
  selectedDayNumbers: number[];
  focusTopicSlugs: string[];
  selectedDays: RevisionPlanDay[];
};

type ProgramDayLike = {
  id: string;
  day_number: number;
  title: string;
  objective: string | null;
  estimated_minutes_min: number | null;
  estimated_minutes_max: number | null;
  metadata?: Record<string, unknown> | null;
  items: Array<{ item_type: string; item_order: number; title: string | null }>;
};

function getPriorityWeight(mastery: TopicDiagnosticResult["mastery"]) {
  if (mastery === "a_reprendre") return 3;
  if (mastery === "a_renforcer") return 2;
  return 1;
}

function getFallbackDepth(mastery: TopicDiagnosticResult["mastery"]): ControlledDepth {
  if (mastery === "a_reprendre") return "FOUNDATIONS";
  if (mastery === "a_renforcer") return "CONSOLIDATION";
  return "VALIDATION";
}

function normalizeGuideRoute(result: RevisionPlanTopicResult) {
  if (result.guideRoute) return result.guideRoute;
  const recommendation = getGuideRecommendation(result.topicSlug, result.depth ?? getFallbackDepth(result.mastery));
  if (!recommendation) return null;
  return {
    day_number: recommendation.dayNumber,
    day_title: recommendation.dayTitle,
    guide_title: recommendation.guideTitle,
    page_reference: `Pages ${recommendation.pageStart}-${recommendation.pageEnd}`,
    primary_part: recommendation.primaryPartLabel,
    primary_level: recommendation.primaryLevelLabel,
    mini_test_ref: recommendation.miniTestRef,
  };
}

function extractExerciseNumbers(day: ProgramDayLike) {
  const exerciseOrders = day.items
    .filter((item) => item.item_type === "exercise")
    .map((item) => item.item_order)
    .sort((a, b) => a - b);
  if (exerciseOrders.length === 0) return "Guide papier";
  if (exerciseOrders.length === 1) return String(exerciseOrders[0]);
  return `${exerciseOrders[0]} a ${exerciseOrders[exerciseOrders.length - 1]}`;
}

function formatExerciseNumbersFromRecommendation(recommendation: NonNullable<ReturnType<typeof getGuideRecommendation>>) {
  const primary = recommendation.sequence[0];
  if (!primary) return null;
  if (typeof primary.exercise_start === "number" && typeof primary.exercise_end === "number") {
    if (primary.part_code === "MINI_TEST") {
      return primary.exercise_start === primary.exercise_end
        ? `Mini-test T${primary.exercise_start}`
        : `Mini-test T${primary.exercise_start} a T${primary.exercise_end}`;
    }
    return primary.exercise_start === primary.exercise_end
      ? `Exercice ${primary.exercise_start}`
      : `Exercices ${primary.exercise_start} a ${primary.exercise_end}`;
  }
  if (typeof primary.mini_test_ref === "string" && primary.part_code === "MINI_TEST") {
    return `Mini-test ${primary.mini_test_ref}`;
  }
  return null;
}

function getTopicSlugs(day: ProgramDayLike) {
  const raw = day.metadata?.topic_slugs;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
}

function uniqueNumbers(values: Array<number | null | undefined>) {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .filter((value, index, array) => array.indexOf(value) === index);
}

export function buildPersonalizedRevisionPlan(
  programDays: ProgramDayLike[],
  diagnosticResults: RevisionPlanTopicResult[],
) {
  const orderedResults = [...diagnosticResults].sort((a, b) => {
    const priorityDiff = getPriorityWeight(b.mastery) - getPriorityWeight(a.mastery);
    if (priorityDiff !== 0) return priorityDiff;
    return a.topicSlug.localeCompare(b.topicSlug);
  });

  const focusTopicSlugs = orderedResults
    .filter((item) => item.mastery !== "maitrise")
    .map((item) => item.topicSlug);

  const redCount = orderedResults.filter((item) => item.mastery === "a_reprendre").length;
  const orangeCount = orderedResults.filter((item) => item.mastery === "a_renforcer").length;
  const weightedNeeds = (redCount * 2) + orangeCount;

  const nonMasteredResults = orderedResults.filter((item) => item.mastery !== "maitrise");
  const indispensableDayNumbers = uniqueNumbers(
    nonMasteredResults.flatMap((item) => [
      normalizeGuideRoute(item)?.day_number ?? null,
      ...(item.recommendedDayNumbers ?? []),
    ]),
  ).filter((value) => value >= 1 && value <= 13);
  const indispensableDayCount = indispensableDayNumbers.length;

  const priorityByTopic = new Map(nonMasteredResults.map((item) => [item.topicSlug, item]));
  const selected = new Map<number, ProgramDayLike>();

  for (const dayNumber of indispensableDayNumbers) {
    const day = programDays.find((item) => item.day_number === dayNumber);
    if (day) selected.set(day.day_number, day);
  }

  const finalTestDay = programDays.find((day) => day.day_number === 14);
  if (finalTestDay) selected.set(14, finalTestDay);

  const selectedDays = [...selected.values()]
    .sort((a, b) => a.day_number - b.day_number)
    .map((day) => {
      const topicSlugs = getTopicSlugs(day);
      const leadResult = topicSlugs
        .map((topicSlug) => priorityByTopic.get(topicSlug))
        .find((item): item is RevisionPlanTopicResult => item != null)
        ?? nonMasteredResults.find((item) => {
          const recommendation = normalizeGuideRoute(item);
          return recommendation?.day_number === day.day_number || item.recommendedDayNumbers.includes(day.day_number);
        })
        ?? null;
      const recommendation = day.day_number === 14
        ? null
        : (leadResult ? normalizeGuideRoute(leadResult) : null);
      const referentialRecommendation = day.day_number === 14 || !leadResult
        ? null
        : getGuideRecommendation(leadResult.topicSlug, leadResult.depth ?? getFallbackDepth(leadResult.mastery));
      return {
        dayId: day.id,
        dayNumber: day.day_number,
        title: day.day_number === 14 ? bridgeFinalTestReference.dayTitle : (recommendation?.day_title ?? day.title),
        objective: day.objective,
        guideLabel: recommendation?.guide_title ?? bridgeFinalTestReference.guideTitle,
        pageReference: day.day_number === 14
          ? `Pages ${bridgeFinalTestReference.pageStart}-${bridgeFinalTestReference.pageEnd}`
          : recommendation?.page_reference ?? (typeof day.metadata?.page_reference === "string" ? day.metadata.page_reference : null),
        exerciseNumbers: day.day_number === 14
          ? "Test Passerelle"
          : referentialRecommendation ? (formatExerciseNumbersFromRecommendation(referentialRecommendation) ?? extractExerciseNumbers(day)) : extractExerciseNumbers(day),
        estimatedMinutes: Math.max(day.estimated_minutes_min ?? 0, day.estimated_minutes_max ?? 0, 20),
        priority: leadResult?.mastery ?? "maitrise",
        topicSlugs,
        recommendedPart: day.day_number === 14 ? "Validation finale" : recommendation?.primary_part ?? "Guide papier",
        recommendedLevel: day.day_number === 14 ? "Test Passerelle" : recommendation?.primary_level ?? "Guide papier",
        lessonAi: leadResult?.lessonAi ?? null,
        followUpQuestions: leadResult?.followUpQuestions ?? [],
        isFinalValidation: day.day_number === 14,
      } satisfies RevisionPlanDay;
    });
  const targetDays = Math.min(14, Math.max(selectedDays.length, finalTestDay ? 1 : 0));

  return {
    targetDays,
    weightedNeeds,
    indispensableDayCount,
    selectedDayNumbers: selectedDays.map((day) => day.dayNumber),
    focusTopicSlugs,
    selectedDays,
  } satisfies RevisionPlan;
}
