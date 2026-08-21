import { topicLabels } from "./topics.ts";

export type RecommendationProgressBand = "maitrise" | "a_renforcer" | "a_reprendre" | "unknown";
export type RecommendationItemStatus = "not_started" | "in_progress" | "completed" | "needs_review";
export type RecommendationItemType = "lesson" | "example" | "exercise" | "revision" | "weekly_test";

export type RecommendationProgress = {
  topic_slug: string | null;
  score: number | null;
  mastery: string | null;
};

export type RecommendationItem = {
  id: string;
  item_type: RecommendationItemType;
  title: string;
  status: RecommendationItemStatus;
  estimated_minutes: number | null;
  guide_reference: string | null;
  page_reference: string | null;
  exercise_reference: string | null;
};

export type RecommendationWeek = {
  id: string;
  week_number: number;
  title: string;
  objective: string | null;
  status: RecommendationItemStatus;
  topic_slug: string | null;
  topic_name: string | null;
  guide_reference: string | null;
  page_reference: string | null;
  estimated_minutes: number | null;
  items: RecommendationItem[];
};

export type StudyPlanRecommendationItem = {
  day_label: string;
  topic: string;
  reference_label: string;
  topic_slug: string | null;
};

export type ActiveExamPlan = {
  id: string;
  exam_date: string;
  days_until_exam: number;
  items: StudyPlanRecommendationItem[];
  current_item: StudyPlanRecommendationItem | null;
};

export type RecommendationLessonAi = {
  title: string;
  duration_minutes: number;
  explanation: string;
  examples: string[];
};

export type RecommendedSession = {
  source: "annual" | "exam_prep";
  reason: string;
  title: string;
  topic_slug: string | null;
  topic_label: string;
  guide_reference: string | null;
  page_reference: string | null;
  exercise_reference: string | null;
  reference_label: string;
  estimated_minutes: number | null;
  week_id: string | null;
  week_item_id: string | null;
  week_number: number | null;
  lesson_ai: RecommendationLessonAi | null;
};

const TOPIC_PREREQUISITES: Record<string, string[]> = {
  fractions: ["relatifs_signes", "priorites_operatoires"],
  calcul_litteral_reduction: ["relatifs_signes", "fractions"],
  developpement: ["calcul_litteral_reduction"],
  identites_remarquables: ["developpement"],
  factorisation_facteur_commun: ["calcul_litteral_reduction"],
  factorisation_identites: ["identites_remarquables", "developpement"],
  equations: ["calcul_litteral_reduction", "fractions"],
  inequations: ["equations"],
  proportionnalite: ["fractions"],
  pourcentages: ["proportionnalite"],
  pythagore_reciproque: ["pythagore"],
  geometrie_milieux: ["proportionnalite"],
  coordonnees_milieu: ["geometrie_milieux"],
  vecteurs_chasles: ["coordonnees_milieu"],
  statistiques_frequence: ["statistiques_moyenne"],
  grandeurs_espace: ["proportionnalite"],
};

const ACTIONABLE_ITEM_ORDER: RecommendationItemType[] = ["exercise", "revision", "weekly_test", "lesson", "example"];

function normalizeDateOnly(value: string) {
  return value.slice(0, 10);
}

function toDaysBetween(today: string, target: string) {
  const start = new Date(`${normalizeDateOnly(today)}T00:00:00Z`).getTime();
  const end = new Date(`${normalizeDateOnly(target)}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86400000);
}

export function getProgressBand(score: number | null, mastery: string | null | undefined): RecommendationProgressBand {
  if (typeof score === "number") {
    if (score >= 80) return "maitrise";
    if (score < 45) return "a_reprendre";
    return "a_renforcer";
  }
  if (mastery === "maitrise" || mastery === "a_renforcer" || mastery === "a_reprendre") return mastery;
  return "unknown";
}

function getProgressScore(progress: RecommendationProgress | undefined) {
  if (!progress || typeof progress.score !== "number") return 55;
  return progress.score;
}

function getTopicLabel(topicSlug: string | null, fallback: string) {
  if (!topicSlug) return fallback;
  return topicLabels[topicSlug] ?? fallback;
}

function pickActionableItem(week: RecommendationWeek) {
  const ordered = [...week.items].sort((left, right) => {
    const typeDelta = ACTIONABLE_ITEM_ORDER.indexOf(left.item_type) - ACTIONABLE_ITEM_ORDER.indexOf(right.item_type);
    if (typeDelta !== 0) return typeDelta;
    return left.title.localeCompare(right.title);
  });
  return ordered.find((item) => item.status !== "completed") ?? ordered[0] ?? null;
}

function buildReferenceLabel(guideReference: string | null, pageReference: string | null, exerciseReference: string | null) {
  const parts = [guideReference, pageReference, exerciseReference].filter((value): value is string => Boolean(value && value.trim()));
  return parts.length ? parts.join(" · ") : "Référence du guide en cours de préparation";
}

function buildAnnualSession(week: RecommendationWeek, reason: string, lessonAi: RecommendationLessonAi | null): RecommendedSession | null {
  const item = pickActionableItem(week);
  if (!item) return null;
  const guideReference = item.guide_reference ?? week.guide_reference ?? null;
  const pageReference = item.page_reference ?? week.page_reference ?? null;
  const exerciseReference = item.exercise_reference ?? null;
  return {
    source: "annual",
    reason,
    title: item.title || week.title,
    topic_slug: week.topic_slug,
    topic_label: getTopicLabel(week.topic_slug, week.topic_name ?? week.title),
    guide_reference: guideReference,
    page_reference: pageReference,
    exercise_reference: exerciseReference,
    reference_label: buildReferenceLabel(guideReference, pageReference, exerciseReference),
    estimated_minutes: item.estimated_minutes ?? week.estimated_minutes ?? null,
    week_id: week.id,
    week_item_id: item.id,
    week_number: week.week_number,
    lesson_ai: lessonAi,
  };
}

export function selectActiveExamPlan(plans: Array<{ id: string; exam_date: string; study_plan_items?: StudyPlanRecommendationItem[] }>, today: string) {
  const upcomingPlans = plans
    .map((plan) => ({ ...plan, days_until_exam: toDaysBetween(today, plan.exam_date) }))
    .filter((plan) => plan.days_until_exam >= 0)
    .sort((left, right) => left.days_until_exam - right.days_until_exam);
  const active = upcomingPlans[0];
  if (!active) return null;
  const items = active.study_plan_items ?? [];
  const currentItem = active.days_until_exam <= 1
    ? items.find((item) => item.day_label.toLowerCase().includes("veille")) ?? items.at(-1) ?? null
    : items[0] ?? null;
  return {
    id: active.id,
    exam_date: active.exam_date,
    days_until_exam: active.days_until_exam,
    items,
    current_item: currentItem,
  } satisfies ActiveExamPlan;
}

export function selectRecommendedSession(input: {
  today: string;
  currentTopicSlug: string;
  progress: RecommendationProgress[];
  weeks: RecommendationWeek[];
  activeExamPlan: ActiveExamPlan | null;
  lessonAiByTopic: Map<string, RecommendationLessonAi | null>;
}): RecommendedSession | null {
  if (input.activeExamPlan?.current_item) {
    const item = input.activeExamPlan.current_item;
    return {
      source: "exam_prep",
      reason: `Priorité temporaire car un devoir est prévu le ${input.activeExamPlan.exam_date}.`,
      title: item.topic,
      topic_slug: item.topic_slug,
      topic_label: item.topic,
      guide_reference: null,
      page_reference: null,
      exercise_reference: item.reference_label,
      reference_label: item.reference_label,
      estimated_minutes: null,
      week_id: null,
      week_item_id: null,
      week_number: null,
      lesson_ai: item.topic_slug ? (input.lessonAiByTopic.get(item.topic_slug) ?? null) : null,
    };
  }

  const candidateWeeks = input.weeks.filter((week) =>
    week.status !== "completed" && week.items.some((item) => item.status !== "completed"));
  if (candidateWeeks.length === 0) return null;

  const progressMap = new Map(
    input.progress
      .filter((item) => item.topic_slug)
      .map((item) => [String(item.topic_slug), item]),
  );

  const currentTopicProgress = progressMap.get(input.currentTopicSlug);
  const currentTopicBand = getProgressBand(currentTopicProgress?.score ?? null, currentTopicProgress?.mastery);
  const currentTopicWeek = candidateWeeks.find((week) => week.topic_slug === input.currentTopicSlug);
  if (currentTopicWeek && currentTopicBand !== "maitrise") {
    const currentReason = currentTopicBand === "a_reprendre"
      ? "Priorité car cette notion est actuellement étudiée en classe et reste fragile."
      : "Consolidation recommandée avant de poursuivre le chapitre actuel.";
    return buildAnnualSession(currentTopicWeek, currentReason, input.lessonAiByTopic.get(input.currentTopicSlug) ?? null);
  }

  const prerequisiteSlugs = TOPIC_PREREQUISITES[input.currentTopicSlug] ?? [];
  const weakestPrerequisite = prerequisiteSlugs
    .map((topicSlug) => ({
      topicSlug,
      progress: progressMap.get(topicSlug),
      week: candidateWeeks.find((week) => week.topic_slug === topicSlug),
    }))
    .filter((candidate) => candidate.week)
    .sort((left, right) => getProgressScore(left.progress) - getProgressScore(right.progress))[0];
  if (weakestPrerequisite && getProgressBand(weakestPrerequisite.progress?.score ?? null, weakestPrerequisite.progress?.mastery) !== "maitrise") {
    return buildAnnualSession(
      weakestPrerequisite.week!,
      "Prérequis nécessaire pour comprendre le chapitre actuel.",
      input.lessonAiByTopic.get(weakestPrerequisite.topicSlug) ?? null,
    );
  }

  const fragileWeek = candidateWeeks
    .map((week) => ({
      week,
      progress: week.topic_slug ? progressMap.get(week.topic_slug) : undefined,
    }))
    .filter((candidate) => getProgressBand(candidate.progress?.score ?? null, candidate.progress?.mastery) !== "maitrise")
    .sort((left, right) => {
      const scoreDelta = getProgressScore(left.progress) - getProgressScore(right.progress);
      if (scoreDelta !== 0) return scoreDelta;
      return left.week.week_number - right.week.week_number;
    })[0];
  if (fragileWeek) {
    return buildAnnualSession(
      fragileWeek.week,
      "Cette séance cible une notion encore fragile repérée dans la progression récente.",
      fragileWeek.week.topic_slug ? (input.lessonAiByTopic.get(fragileWeek.week.topic_slug) ?? null) : null,
    );
  }

  return buildAnnualSession(candidateWeeks[0], "Prochaine étape cohérente du parcours annuel.", candidateWeeks[0].topic_slug ? (input.lessonAiByTopic.get(candidateWeeks[0].topic_slug) ?? null) : null);
}

export function buildWeeklyProgress(input: { week: RecommendationWeek | null }) {
  const week = input.week;
  if (!week) return { completed: 0, total: 0 };
  const actionableItems = week.items.filter((item) => ACTIONABLE_ITEM_ORDER.includes(item.item_type));
  const total = actionableItems.length;
  const completed = actionableItems.filter((item) => item.status === "completed").length;
  return { completed, total };
}

export function buildNextStepSummary(input: {
  activeExamPlan: ActiveExamPlan | null;
  recommendedSession: RecommendedSession | null;
  currentWeek: RecommendationWeek | null;
}) {
  if (input.activeExamPlan) {
    return `Après le devoir du ${input.activeExamPlan.exam_date}, ÉLAN reprendra automatiquement le parcours annuel.`;
  }
  if (input.currentWeek && input.recommendedSession?.week_number === input.currentWeek.week_number) {
    return `Objectif en cours : terminer la semaine ${input.currentWeek.week_number} avant de passer à la suite du programme annuel.`;
  }
  if (input.recommendedSession?.week_number) {
    return `Prochaine référence pédagogique : semaine ${input.recommendedSession.week_number}.`;
  }
  return "Le prochain jalon apparaîtra dès qu’une nouvelle séance sera disponible.";
}
