import { randomUUID } from "node:crypto";
import {
  buildNextStepSummary,
  buildWeeklyProgress,
  type RecommendationLessonAi,
  selectActiveExamPlan,
  selectRecommendedSession,
} from "@/lib/annual-recommendation";
import { AnnualProgressStatus, computeWeekStatus, shouldTransitionToAnnual } from "@/lib/annual-rules";
import { getLatestAnalysisForStudent, listStudyPlans, listSubmissionsWithAnalyses, requireOwnedStudent } from "@/lib/app-data";
import { getPretProgramState } from "@/lib/pret-program";
import { createAdminClient } from "@/lib/supabase/admin";
import { topicLabels } from "@/lib/topics";

const ANNUAL_PROGRAM_SLUG = "suivi-annuel-3e";
export type { AnnualProgressStatus } from "@/lib/annual-rules";

export type AnnualWeekItem = {
  id: string;
  item_type: "lesson" | "example" | "exercise" | "revision" | "weekly_test";
  title: string;
  instructions: string | null;
  guide_reference: string | null;
  page_reference: string | null;
  exercise_reference: string | null;
  estimated_minutes: number | null;
  status: AnnualProgressStatus;
  score: number | null;
};

export type AnnualWeek = {
  id: string;
  week_number: number;
  school_term: string | null;
  title: string;
  objective: string | null;
  estimated_minutes: number | null;
  guide_reference: string | null;
  page_reference: string | null;
  instructions: string | null;
  topic_slug: string | null;
  topic_name: string | null;
  status: AnnualProgressStatus;
  completedItems: number;
  items: AnnualWeekItem[];
};

type AnnualLessonAi = RecommendationLessonAi;

export type AnnualRecommendedSession = ReturnType<typeof selectRecommendedSession>;

export type AnnualExamPlan = ReturnType<typeof selectActiveExamPlan>;

export type AnnualProgramState = {
  schemaAvailable: boolean;
  phase: "preparation" | "annual_tracking";
  programId: string | null;
  enrollmentId: string | null;
  enrolled: boolean;
  contentReady: boolean;
  weeks: AnnualWeek[];
  currentWeek: AnnualWeek | null;
  completedWeeks: number;
  progressPercent: number;
  reviewTopics: string[];
  latestAnalysis: Awaited<ReturnType<typeof getLatestAnalysisForStudent>> | null;
  latestSubmission: Awaited<ReturnType<typeof listSubmissionsWithAnalyses>>[number] | null;
  recommendedSession: AnnualRecommendedSession;
  activeExamPlan: AnnualExamPlan;
  weeklyProgress: { completed: number; total: number };
  nextStepSummary: string;
};

function isMissingAnnualSchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "42P01" || candidate.code === "42703"
    || /Could not find the table|relation .* does not exist|column .* does not exist|function .* does not exist/i.test(candidate.message ?? "");
}

function emptyAnnualState(
  latestAnalysis: AnnualProgramState["latestAnalysis"],
  latestSubmission: AnnualProgramState["latestSubmission"],
): AnnualProgramState {
  return {
    schemaAvailable: false,
    phase: "preparation",
    programId: null,
    enrollmentId: null,
    enrolled: false,
    contentReady: false,
    weeks: [],
    currentWeek: null,
    completedWeeks: 0,
    progressPercent: 0,
    reviewTopics: latestAnalysis?.notions_a_revoir ?? [],
    latestAnalysis,
    latestSubmission,
    recommendedSession: null,
    activeExamPlan: null,
    weeklyProgress: { completed: 0, total: 0 },
    nextStepSummary: "Le parcours annuel s’activera dès que les séances seront disponibles.",
  };
}

function normalizeStudyPlanTopicLabel(value: string | null | undefined) {
  return (value ?? "").trim();
}

function findTopicSlugByLabel(label: string | null | undefined) {
  const normalized = normalizeStudyPlanTopicLabel(label).toLowerCase();
  if (!normalized) return null;
  const matchingEntry = Object.entries(topicLabels).find(([, topicLabel]) => topicLabel.toLowerCase() === normalized);
  return matchingEntry?.[0] ?? null;
}

function parseLatestLessonAiByTopic(latestAnalysis: AnnualProgramState["latestAnalysis"]) {
  const lessons = new Map<string, AnnualLessonAi | null>();
  const topicResults = Array.isArray((latestAnalysis as { topic_results?: unknown[] } | null)?.topic_results)
    ? ((latestAnalysis as { topic_results?: unknown[] }).topic_results ?? [])
    : [];
  for (const item of topicResults) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as {
      topic_slug?: unknown;
      lesson_ai?: unknown;
      mastery?: unknown;
    };
    if (typeof candidate.topic_slug !== "string") continue;
    if (candidate.mastery === "maitrise") {
      lessons.set(candidate.topic_slug, null);
      continue;
    }
    if (!candidate.lesson_ai || typeof candidate.lesson_ai !== "object") continue;
    const lesson = candidate.lesson_ai as {
      title?: unknown;
      duration_minutes?: unknown;
      explanation?: unknown;
      examples?: unknown;
    };
    if (typeof lesson.title !== "string" || typeof lesson.explanation !== "string") continue;
    lessons.set(candidate.topic_slug, {
      title: lesson.title,
      duration_minutes: typeof lesson.duration_minutes === "number" ? lesson.duration_minutes : 5,
      explanation: lesson.explanation,
      examples: Array.isArray(lesson.examples) ? lesson.examples.filter((entry): entry is string => typeof entry === "string") : [],
    });
  }
  return lessons;
}

function toNullableString(value: unknown) {
  return value == null ? null : String(value);
}

function toNullableNumber(value: unknown) {
  return value == null ? null : Number(value);
}

export async function getAnnualProgramState(studentId: string): Promise<AnnualProgramState> {
  const [{ student, supabase }, latestAnalysis, submissions, studyPlans] = await Promise.all([
    requireOwnedStudent(studentId),
    getLatestAnalysisForStudent(studentId),
    listSubmissionsWithAnalyses(studentId),
    listStudyPlans(studentId),
  ]);
  const latestSubmission = submissions[0] ?? null;
  const phase = (student as { active_phase?: string }).active_phase === "annual_tracking" ? "annual_tracking" : "preparation";

  const programQuery = await supabase
    .from("annual_programs")
    .select("id, content_ready")
    .eq("slug", ANNUAL_PROGRAM_SLUG)
    .eq("active", true)
    .maybeSingle();
  if (programQuery.error) {
    if (isMissingAnnualSchema(programQuery.error)) return emptyAnnualState(latestAnalysis, latestSubmission);
    throw programQuery.error;
  }
  if (!programQuery.data) return { ...emptyAnnualState(latestAnalysis, latestSubmission), schemaAvailable: true, phase };

  const enrollmentQuery = await supabase
    .from("student_annual_enrollments")
    .select("id")
    .eq("student_id", studentId)
    .eq("annual_program_id", programQuery.data.id)
    .maybeSingle();
  if (enrollmentQuery.error) throw enrollmentQuery.error;
  const enrollmentId = enrollmentQuery.data?.id ?? null;

  const weeksQuery = await supabase
    .from("annual_program_weeks")
    .select(`id, week_number, school_term, title, objective, estimated_minutes, guide_reference, page_reference, instructions, topic_id,
      annual_week_items (id, item_type, title, instructions, guide_reference, page_reference, estimated_minutes, sort_order, exercise_id)`)
    .eq("annual_program_id", programQuery.data.id)
    .eq("published", true)
    .eq("content_ready", true)
    .order("week_number");
  if (weeksQuery.error) throw weeksQuery.error;

  const weekRows = (weeksQuery.data ?? []) as Array<Record<string, unknown>>;
  const topicIds = [...new Set(weekRows.map((week) => String(week.topic_id ?? "")).filter(Boolean))];
  const exerciseIds = [...new Set(
    weekRows.flatMap((week) => {
      const items = (week.annual_week_items as Array<Record<string, unknown>> | null) ?? [];
      return items.map((item) => String(item.exercise_id ?? "")).filter(Boolean);
    }),
  )];

  const [topicsQuery, exercisesQuery] = await Promise.all([
    topicIds.length
      ? supabase.from("topics").select("id, slug, name").in("id", topicIds)
      : Promise.resolve({ data: [], error: null }),
    exerciseIds.length
      ? supabase.from("exercises").select("id, document, section, exercise_number").in("id", exerciseIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (topicsQuery.error) throw topicsQuery.error;
  if (exercisesQuery.error) throw exercisesQuery.error;

  let weekProgressRows: Array<{ week_id: string; status: AnnualProgressStatus }> = [];
  let itemProgressRows: Array<{ week_item_id: string; status: AnnualProgressStatus; score: number | null }> = [];
  if (enrollmentId) {
    const [weekProgress, itemProgress] = await Promise.all([
      supabase.from("student_week_progress").select("week_id, status").eq("enrollment_id", enrollmentId),
      supabase.from("student_week_item_progress").select("week_item_id, status, score").eq("enrollment_id", enrollmentId),
    ]);
    if (weekProgress.error) throw weekProgress.error;
    if (itemProgress.error) throw itemProgress.error;
    weekProgressRows = (weekProgress.data ?? []) as typeof weekProgressRows;
    itemProgressRows = (itemProgress.data ?? []) as typeof itemProgressRows;
  }

  const weekProgressMap = new Map(weekProgressRows.map((row) => [row.week_id, row.status]));
  const itemProgressMap = new Map(itemProgressRows.map((row) => [row.week_item_id, row]));
  const topicMap = new Map(((topicsQuery.data ?? []) as Array<{ id: string; slug: string; name: string }>).map((topic) => [topic.id, topic]));
  const exerciseMap = new Map(((exercisesQuery.data ?? []) as Array<{ id: string; document: string | null; section: string | null; exercise_number: string | null }>).map((exercise) => [exercise.id, exercise]));
  const weeks = weekRows.map((week) => {
    const rawItems = (week.annual_week_items as Array<Record<string, unknown>> | null) ?? [];
    const items = rawItems
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      .map((item) => {
        const progress = itemProgressMap.get(String(item.id));
        const exercise = exerciseMap.get(String(item.exercise_id ?? ""));
        return {
          id: String(item.id),
          item_type: String(item.item_type) as AnnualWeekItem["item_type"],
          title: String(item.title),
          instructions: item.instructions == null ? null : String(item.instructions),
          guide_reference: item.guide_reference == null ? null : String(item.guide_reference),
          page_reference: item.page_reference == null ? null : String(item.page_reference),
          exercise_reference: exercise?.exercise_number
            ? `${exercise.document ?? "Guide 2"} · ${exercise.section ?? "Exercices"} · exercices ${exercise.exercise_number}`
            : null,
          estimated_minutes: item.estimated_minutes == null ? null : Number(item.estimated_minutes),
          status: progress?.status ?? "not_started",
          score: progress?.score == null ? null : Number(progress.score),
        } satisfies AnnualWeekItem;
      });
    const computed = computeWeekStatus(items.map((item) => item.status));
    const topic = topicMap.get(String(week.topic_id ?? ""));
    return {
      id: String(week.id),
      week_number: Number(week.week_number),
      school_term: toNullableString(week.school_term),
      title: String(week.title ?? "Semaine"),
      objective: toNullableString(week.objective),
      estimated_minutes: toNullableNumber(week.estimated_minutes),
      guide_reference: toNullableString(week.guide_reference),
      page_reference: toNullableString(week.page_reference),
      instructions: toNullableString(week.instructions),
      topic_slug: topic?.slug ?? null,
      topic_name: topic?.name ?? null,
      status: weekProgressMap.get(String(week.id)) ?? computed,
      completedItems: items.filter((item) => item.status === "completed").length,
      items,
    } satisfies AnnualWeek;
  });
  const completedWeeks = weeks.filter((week) => week.status === "completed").length;
  const currentWeek = weeks.find((week) => week.status !== "completed") ?? weeks.at(-1) ?? null;
  const itemReviewTopics = weeks.flatMap((week) => week.items.filter((item) => item.status === "needs_review").map((item) => item.title));
  const lessonAiByTopic = parseLatestLessonAiByTopic(latestAnalysis);
  const today = new Date().toISOString().slice(0, 10);
  const activeExamPlan = selectActiveExamPlan(
    studyPlans.map((plan) => ({
      id: String(plan.id),
      exam_date: String(plan.exam_date),
      study_plan_items: Array.isArray(plan.study_plan_items)
        ? plan.study_plan_items.map((item: Record<string, unknown>) => ({
          day_label: String(item.day_label ?? ""),
          topic: String(item.topic ?? "Révision ciblée"),
          reference_label: String(item.exercises ?? "Référence du guide en cours de préparation"),
          topic_slug: findTopicSlugByLabel(typeof item.topic === "string" ? item.topic : null),
        }))
        : [],
    })),
    today,
  );
  const progressQuery = await supabase
    .from("student_topic_progress")
    .select("score, mastery, topics!inner(slug)")
    .eq("student_id", studentId);
  if (progressQuery.error) throw progressQuery.error;
  const recommendedSession = selectRecommendedSession({
    today,
    currentTopicSlug: String(student.current_topic_slug ?? ""),
    progress: (progressQuery.data ?? []).map((row) => ({
        topic_slug: Array.isArray(row.topics) ? String(row.topics[0]?.slug ?? "") : String((row.topics as { slug?: string } | null)?.slug ?? ""),
        score: row.score == null ? null : Number(row.score),
        mastery: row.mastery == null ? null : String(row.mastery),
      })),
    weeks,
    activeExamPlan,
    lessonAiByTopic,
  });
  const weeklyProgress = buildWeeklyProgress({ week: currentWeek });
  const nextStepSummary = buildNextStepSummary({
    activeExamPlan,
    recommendedSession,
    currentWeek,
  });

  return {
    schemaAvailable: true,
    phase,
    programId: programQuery.data.id,
    enrollmentId,
    enrolled: Boolean(enrollmentId),
    contentReady: Boolean(programQuery.data.content_ready) && weeks.length > 0,
    weeks,
    currentWeek,
    completedWeeks,
    progressPercent: weeks.length ? Math.round((completedWeeks / weeks.length) * 100) : 0,
    reviewTopics: [...new Set([...(latestAnalysis?.notions_a_revoir ?? []), ...itemReviewTopics])],
    latestAnalysis,
    latestSubmission,
    recommendedSession,
    activeExamPlan,
    weeklyProgress,
    nextStepSummary,
  };
}

export async function startAnnualTracking(studentId: string) {
  const { supabase } = await requireOwnedStudent(studentId);
  const result = await supabase.rpc("start_annual_tracking", { p_student_id: studentId });
  if (result.error) throw result.error;
  return result.data as string;
}

export async function getLearningJourneyState(studentId: string) {
  const preparation = await getPretProgramState(studentId);
  let annual = await getAnnualProgramState(studentId);

  if (annual.schemaAvailable && shouldTransitionToAnnual(preparation.completedDays, preparation.totalDays, annual.enrolled)) {
    await startAnnualTracking(studentId);
    annual = await getAnnualProgramState(studentId);
  }
  return { preparation, annual, phase: annual.phase };
}

export async function updateAnnualProgressAfterAnalysis(input: {
  submissionId: string;
  studentId: string;
  annualWeekId?: string | null;
  annualWeekItemId?: string | null;
  score: number | null;
  status: "reussi" | "partiel" | "a_revoir";
  provider: string;
}) {
  if (!input.annualWeekId || !input.annualWeekItemId) return;
  const supabase = createAdminClient();
  const enrollment = await supabase.from("student_annual_enrollments").select("id").eq("student_id", input.studentId).eq("status", "active").maybeSingle();
  if (enrollment.error) {
    if (isMissingAnnualSchema(enrollment.error)) return;
    throw enrollment.error;
  }
  if (!enrollment.data) return;

  const item = await supabase.from("annual_week_items").select("id, week_id").eq("id", input.annualWeekItemId).eq("week_id", input.annualWeekId).eq("published", true).maybeSingle();
  if (item.error || !item.data) throw item.error ?? new Error("Item annuel invalide.");

  const existing = await supabase.from("student_week_item_progress").select("attempts").eq("enrollment_id", enrollment.data.id).eq("week_item_id", item.data.id).maybeSingle();
  if (existing.error) throw existing.error;
  const status: AnnualProgressStatus = input.status === "reussi" ? "completed" : input.status === "a_revoir" ? "needs_review" : "in_progress";
  const upsertItem = await supabase.from("student_week_item_progress").upsert({
    id: randomUUID(),
    enrollment_id: enrollment.data.id,
    week_item_id: item.data.id,
    status,
    score: input.provider === "gemini" ? input.score : null,
    attempts: Number(existing.data?.attempts ?? 0) + 1,
    last_attempt_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "enrollment_id,week_item_id" });
  if (upsertItem.error) throw upsertItem.error;

  const [publishedItems, progress] = await Promise.all([
    supabase.from("annual_week_items").select("id").eq("week_id", input.annualWeekId).eq("published", true),
    supabase.from("student_week_item_progress").select("week_item_id, status").eq("enrollment_id", enrollment.data.id),
  ]);
  if (publishedItems.error) throw publishedItems.error;
  if (progress.error) throw progress.error;
  const progressByItem = new Map((progress.data ?? []).map((row) => [row.week_item_id, row.status as AnnualProgressStatus]));
  const statuses = (publishedItems.data ?? []).map((row) => progressByItem.get(row.id) ?? "not_started");
  const weekStatus = computeWeekStatus(statuses);
  const upsertWeek = await supabase.from("student_week_progress").upsert({
    id: randomUUID(),
    enrollment_id: enrollment.data.id,
    week_id: input.annualWeekId,
    status: weekStatus,
    started_at: new Date().toISOString(),
    completed_at: weekStatus === "completed" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "enrollment_id,week_id" });
  if (upsertWeek.error) throw upsertWeek.error;

  const submission = await supabase.from("work_submissions").update({
    annual_week_id: input.annualWeekId,
    annual_week_item_id: input.annualWeekItemId,
  }).eq("id", input.submissionId).eq("student_id", input.studentId);
  if (submission.error) throw submission.error;
}
