import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { addNotificationIfAbsent, getLatestAnalysisForStudent, getLatestDiagnosticAnalysisForStudent, listSubmissionsWithAnalyses, requireOwnedStudent } from "@/lib/app-data";
import { buildPersonalizedRevisionPlan } from "@/lib/revision-plan";

const PRET_PROGRAM_SLUG = "pret-pour-la-3e-14-jours";

type DayStatus = "not_started" | "in_progress" | "completed" | "needs_review";
type PretEnrollmentStatus = "planned" | "active" | "completed" | "paused";

type LessonAi = {
  title: string;
  duration_minutes: number;
  explanation: string;
  examples: string[];
};

type FollowUpQuestion = {
  topic_slug: string;
  question: string;
};

type PretProgramSnapshotDay = {
  program_day_id: string;
  session_index: number;
  guide_day_number: number;
  title: string;
  guide_label: string;
  page_reference: string | null;
  exercise_numbers: string;
  estimated_minutes: number;
  priority: "a_reprendre" | "a_renforcer" | "maitrise";
  topic_slugs: string[];
  recommended_part: string;
  recommended_level: string;
  lesson_ai: LessonAi | null;
  follow_up_questions: FollowUpQuestion[];
  is_final_validation: boolean;
};

type PretProgramSnapshot = {
  version: 1;
  generated_from_analysis_id: string | null;
  target_days: number;
  selected_day_numbers: number[];
  focus_topic_slugs: string[];
  selected_days: PretProgramSnapshotDay[];
};

type ProgramDefinitionItem = {
  id: string;
  item_type: string;
  item_order: number;
  title: string | null;
  prompt: string;
  guide_reference: string;
  correction_reference: string | null;
  difficulty_label: string | null;
  active: boolean;
};

type ProgramDefinitionDay = {
  id: string;
  day_number: number;
  day_kind: string;
  title: string;
  objective: string | null;
  estimated_minutes_min: number | null;
  estimated_minutes_max: number | null;
  metadata: Record<string, unknown>;
  active: boolean;
  items: ProgramDefinitionItem[];
};

export type PretProgramItem = {
  id: string;
  item_type: string;
  item_order: number;
  title: string | null;
  prompt: string;
  guide_reference: string;
  correction_reference: string | null;
  difficulty_label: string | null;
  active: boolean;
  progressStatus: DayStatus;
  score: number | null;
};

export type PretProgramDay = {
  id: string;
  sessionIndex: number | null;
  day_number: number;
  day_kind: string;
  title: string;
  objective: string | null;
  estimated_minutes_min: number | null;
  estimated_minutes_max: number | null;
  active: boolean;
  guideReferences: string[];
  status: DayStatus;
  completedItems: number;
  actionableItems: number;
  topicSlugs: string[];
  guideLabel: string;
  pageReference: string | null;
  exerciseNumbers: string;
  recommendedPart: string;
  recommendedLevel: string;
  lessonAi: LessonAi | null;
  followUpQuestions: FollowUpQuestion[];
  isFinalValidation: boolean;
  includedInPlan: boolean;
  items: PretProgramItem[];
};

export type PretProgramState = {
  available: boolean;
  enrolled: boolean;
  enrollmentId: string | null;
  enrollmentStatus: PretEnrollmentStatus | null;
  hasPlanSnapshot: boolean;
  programId: string | null;
  programTitle: string;
  totalDays: number;
  completedDays: number;
  progressPercent: number;
  currentDayNumber: number | null;
  currentDay: PretProgramDay | null;
  latestAnalysis: Awaited<ReturnType<typeof getLatestAnalysisForStudent>> | null;
  latestDiagnosticAnalysis: Awaited<ReturnType<typeof getLatestDiagnosticAnalysisForStudent>> | null;
  latestSubmission: Awaited<ReturnType<typeof listSubmissionsWithAnalyses>>[number] | null;
  hasDiagnostic: boolean;
  requiresDiagnostic: boolean;
  selectedDayNumbers: number[];
  reviewTopics: string[];
  days: PretProgramDay[];
};

function isMissingProgramError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "42P01"
    || candidate.code === "42703"
    || /Could not find the table|relation .* does not exist|column .* does not exist|function .* does not exist/i.test(candidate.message ?? "");
}

function emptyState(
  latestAnalysis: PretProgramState["latestAnalysis"],
  latestDiagnosticAnalysis: PretProgramState["latestDiagnosticAnalysis"],
  latestSubmission: PretProgramState["latestSubmission"],
): PretProgramState {
  return {
    available: false,
    enrolled: false,
    enrollmentId: null,
    enrollmentStatus: null,
    hasPlanSnapshot: false,
    programId: null,
    programTitle: "PRÊT POUR LA 3e — MATHS BÉNIN",
    totalDays: 14,
    completedDays: 0,
    progressPercent: 0,
    currentDayNumber: null,
    currentDay: null,
    latestAnalysis,
    latestDiagnosticAnalysis,
    latestSubmission,
    hasDiagnostic: Boolean(latestDiagnosticAnalysis),
    requiresDiagnostic: !latestDiagnosticAnalysis,
    selectedDayNumbers: [],
    reviewTopics: latestAnalysis?.notions_a_revoir ?? [],
    days: [],
  };
}

function computeDayStatus(items: PretProgramItem[], storedStatus?: string | null): DayStatus {
  if (storedStatus === "completed") return "completed";
  if (storedStatus === "needs_review") return "needs_review";
  const actionable = items.filter((item) => item.item_type !== "guided_example");
  if (actionable.some((item) => item.progressStatus === "needs_review")) return "needs_review";
  if (actionable.length > 0 && actionable.every((item) => item.progressStatus === "completed")) return "completed";
  if (storedStatus === "in_progress" || actionable.some((item) => item.progressStatus === "completed" || item.progressStatus === "in_progress")) return "in_progress";
  return "not_started";
}

function normalizeRecommendedValue(value: string | null | undefined) {
  if (!value || value === "NOT_DEFINED_IN_GUIDE" || value === "Guide papier") return "Guide papier";
  return value;
}

function parseLessonAi(value: unknown): LessonAi | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.title !== "string" || typeof candidate.explanation !== "string") return null;
  return {
    title: candidate.title,
    duration_minutes: typeof candidate.duration_minutes === "number" ? candidate.duration_minutes : 5,
    explanation: candidate.explanation,
    examples: Array.isArray(candidate.examples) ? candidate.examples.map((item) => String(item)) : [],
  };
}

function parseFollowUpQuestions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const candidate = item as Record<string, unknown>;
      return {
        topic_slug: String(candidate.topic_slug ?? ""),
        question: String(candidate.question ?? ""),
      };
    })
    .filter((item) => item.topic_slug.length > 0 && item.question.length > 0);
}

function parseDiagnosticTopicResults(latestDiagnosticAnalysis: Awaited<ReturnType<typeof getLatestDiagnosticAnalysisForStudent>> | null) {
  return Array.isArray(latestDiagnosticAnalysis?.topic_results)
    ? latestDiagnosticAnalysis.topic_results.map((item: unknown) => ({
      topicSlug: String((item as { topic_slug?: unknown }).topic_slug ?? ""),
      mastery: String((item as { mastery?: unknown }).mastery ?? "a_renforcer") as "maitrise" | "a_renforcer" | "a_reprendre",
      score: Number((item as { score?: unknown }).score ?? 0),
      evidenceCount: Number((item as { evidence_count?: unknown }).evidence_count ?? 0),
      correctCount: Number((item as { correct_count?: unknown }).correct_count ?? 0),
      partialCount: Number((item as { partial_count?: unknown }).partial_count ?? 0),
      incorrectCount: Number((item as { incorrect_count?: unknown }).incorrect_count ?? 0),
      confidence: String((item as { confidence?: unknown }).confidence ?? "low") as "high" | "medium" | "low",
      depth: String((item as { depth?: unknown }).depth ?? "CONSOLIDATION") as "FOUNDATIONS" | "CONSOLIDATION" | "VALIDATION",
      reason: String((item as { reason?: unknown }).reason ?? ""),
      guideRoute: typeof (item as { guide_route?: unknown }).guide_route === "object" && (item as { guide_route?: unknown }).guide_route
        ? (item as {
          guide_route: {
            day_number?: number;
            day_title?: string;
            guide_title?: string;
            page_reference?: string;
            primary_part?: string;
            primary_level?: string;
            mini_test_ref?: string;
          };
        }).guide_route
        : null,
      lessonAi: parseLessonAi((item as { lesson_ai?: unknown }).lesson_ai),
      followUpQuestions: parseFollowUpQuestions((item as { follow_up_questions?: unknown }).follow_up_questions),
      evidence: Array.isArray((item as { evidence?: unknown }).evidence) ? (item as { evidence: string[] }).evidence : [],
      referenceIds: Array.isArray((item as { reference_ids?: unknown }).reference_ids) ? (item as { reference_ids: string[] }).reference_ids : [],
      recommendedDayNumbers: Array.isArray((item as { recommended_day_numbers?: unknown }).recommended_day_numbers)
        ? (item as { recommended_day_numbers: number[] }).recommended_day_numbers.map((value) => Number(value))
        : [],
    }))
    : [];
}

function toSnapshotDay(planDay: ReturnType<typeof buildPersonalizedRevisionPlan>["selectedDays"][number]): PretProgramSnapshotDay {
  return {
    program_day_id: planDay.dayId,
    session_index: 0,
    guide_day_number: planDay.dayNumber,
    title: planDay.title,
    guide_label: planDay.guideLabel,
    page_reference: planDay.pageReference,
    exercise_numbers: planDay.exerciseNumbers,
    estimated_minutes: planDay.estimatedMinutes,
    priority: planDay.priority,
    topic_slugs: planDay.topicSlugs,
    recommended_part: normalizeRecommendedValue(planDay.recommendedPart),
    recommended_level: normalizeRecommendedValue(planDay.recommendedLevel),
    lesson_ai: planDay.priority === "maitrise" ? null : planDay.lessonAi,
    follow_up_questions: planDay.priority === "a_reprendre" ? planDay.followUpQuestions : [],
    is_final_validation: planDay.isFinalValidation,
  };
}

function buildSnapshotFromPlan(plan: ReturnType<typeof buildPersonalizedRevisionPlan>, analysisId: string | null): PretProgramSnapshot {
  const selectedDays = plan.selectedDays.map((day, index) => ({
    ...toSnapshotDay(day),
    session_index: index + 1,
  }));
  return {
    version: 1,
    generated_from_analysis_id: analysisId,
    target_days: selectedDays.length,
    selected_day_numbers: selectedDays.map((day) => day.guide_day_number),
    focus_topic_slugs: plan.focusTopicSlugs,
    selected_days: selectedDays,
  };
}

function isPretEnrollmentStatus(value: unknown): value is PretEnrollmentStatus {
  return value === "planned" || value === "active" || value === "completed" || value === "paused";
}

function parsePlanSnapshot(value: unknown): PretProgramSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.selected_days)) return null;
  const selectedDays = candidate.selected_days
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const day = item as Record<string, unknown>;
      return {
        program_day_id: String(day.program_day_id ?? ""),
        session_index: Number(day.session_index ?? 0),
        guide_day_number: Number(day.guide_day_number ?? 0),
        title: String(day.title ?? ""),
        guide_label: String(day.guide_label ?? "Guide 1 - Diagnostic & Révision"),
        page_reference: day.page_reference == null ? null : String(day.page_reference),
        exercise_numbers: String(day.exercise_numbers ?? "Guide papier"),
        estimated_minutes: Number(day.estimated_minutes ?? 20),
        priority: String(day.priority ?? "a_renforcer") as PretProgramSnapshotDay["priority"],
        topic_slugs: Array.isArray(day.topic_slugs) ? day.topic_slugs.map((value) => String(value)) : [],
        recommended_part: normalizeRecommendedValue(day.recommended_part == null ? null : String(day.recommended_part)),
        recommended_level: normalizeRecommendedValue(day.recommended_level == null ? null : String(day.recommended_level)),
        lesson_ai: parseLessonAi(day.lesson_ai),
        follow_up_questions: parseFollowUpQuestions(day.follow_up_questions),
        is_final_validation: Boolean(day.is_final_validation),
      } satisfies PretProgramSnapshotDay;
    })
    .filter((day) => day.program_day_id.length > 0 && day.session_index > 0)
    .sort((a, b) => a.session_index - b.session_index);
  if (selectedDays.length === 0) return null;
  return {
    version: 1,
    generated_from_analysis_id: typeof candidate.generated_from_analysis_id === "string" ? candidate.generated_from_analysis_id : null,
    target_days: Number(candidate.target_days ?? selectedDays.length),
    selected_day_numbers: Array.isArray(candidate.selected_day_numbers) ? candidate.selected_day_numbers.map((value) => Number(value)) : selectedDays.map((day) => day.guide_day_number),
    focus_topic_slugs: Array.isArray(candidate.focus_topic_slugs) ? candidate.focus_topic_slugs.map((value) => String(value)) : [],
    selected_days: selectedDays,
  };
}

async function getPretProgramDefinition(supabase: ReturnType<typeof createAdminClient>) {
  const programQuery = await supabase
    .from("learning_programs")
    .select("id, title, total_days")
    .eq("slug", PRET_PROGRAM_SLUG)
    .eq("active", true)
    .maybeSingle();
  if (programQuery.error) throw programQuery.error;
  if (!programQuery.data) return null;

  const daysQuery = await supabase
    .from("learning_program_days")
    .select(`
      id,
      day_number,
      day_kind,
      title,
      objective,
      estimated_minutes_min,
      estimated_minutes_max,
      metadata,
      active,
      learning_program_items (
        id,
        item_type,
        item_order,
        title,
        prompt,
        guide_reference,
        correction_reference,
        difficulty_label,
        active
      )
    `)
    .eq("program_id", programQuery.data.id)
    .eq("active", true)
    .order("day_number");
  if (daysQuery.error) throw daysQuery.error;

  const days = (daysQuery.data ?? []).map((day) => ({
    id: String(day.id),
    day_number: Number(day.day_number ?? 0),
    day_kind: String(day.day_kind ?? "lesson"),
    title: String(day.title ?? ""),
    objective: day.objective == null ? null : String(day.objective),
    estimated_minutes_min: day.estimated_minutes_min == null ? null : Number(day.estimated_minutes_min),
    estimated_minutes_max: day.estimated_minutes_max == null ? null : Number(day.estimated_minutes_max),
    metadata: (day.metadata as Record<string, unknown> | null) ?? {},
    active: Boolean(day.active ?? true),
    items: ((day.learning_program_items as Array<Record<string, unknown>> | null) ?? [])
      .sort((a, b) => Number(a.item_order ?? 0) - Number(b.item_order ?? 0))
      .map((item) => ({
        id: String(item.id),
        item_type: String(item.item_type ?? ""),
        item_order: Number(item.item_order ?? 0),
        title: item.title == null ? null : String(item.title),
        prompt: String(item.prompt ?? ""),
        guide_reference: String(item.guide_reference ?? ""),
        correction_reference: item.correction_reference == null ? null : String(item.correction_reference),
        difficulty_label: item.difficulty_label == null ? null : String(item.difficulty_label),
        active: Boolean(item.active ?? true),
      })),
  })) satisfies ProgramDefinitionDay[];

  return {
    programId: programQuery.data.id,
    programTitle: String(programQuery.data.title),
    totalDays: Number(programQuery.data.total_days ?? 14),
    days,
  };
}

function buildDayFromDefinition(
  day: ProgramDefinitionDay,
  snapshotDay: PretProgramSnapshotDay | null,
  dayStatus: string | null | undefined,
  itemProgressMap: Map<string, { status: DayStatus | null; score: number | null }>,
): PretProgramDay {
  const items = day.items.map((item) => {
    const progress = itemProgressMap.get(item.id);
    return {
      ...item,
      progressStatus: (progress?.status ?? "not_started") as DayStatus,
      score: progress?.score ?? null,
    } satisfies PretProgramItem;
  });
  const actionableItems = items.filter((item) => item.item_type !== "guided_example");
  const completedItems = actionableItems.filter((item) => item.progressStatus === "completed").length;
  const metadata = day.metadata ?? {};
  const topicSlugs = snapshotDay?.topic_slugs ?? (Array.isArray(metadata.topic_slugs) ? metadata.topic_slugs.filter((item): item is string => typeof item === "string") : []);
  const exerciseOrders = items.filter((item) => item.item_type === "exercise").map((item) => item.item_order).sort((a, b) => a - b);
  const exerciseNumbers = snapshotDay?.exercise_numbers
    ?? (exerciseOrders.length === 0 ? "Guide papier" : exerciseOrders.length === 1 ? String(exerciseOrders[0]) : `${exerciseOrders[0]} à ${exerciseOrders[exerciseOrders.length - 1]}`);

  return {
    id: day.id,
    sessionIndex: snapshotDay?.session_index ?? null,
    day_number: day.day_number,
    day_kind: day.day_kind,
    title: snapshotDay?.title ?? day.title,
    objective: day.objective,
    estimated_minutes_min: day.estimated_minutes_min,
    estimated_minutes_max: day.estimated_minutes_max,
    active: day.active,
    guideReferences: [...new Set(items.map((item) => item.guide_reference).filter(Boolean))],
    status: computeDayStatus(items, dayStatus),
    completedItems,
    actionableItems: actionableItems.length,
    topicSlugs,
    guideLabel: snapshotDay?.guide_label ?? (typeof metadata.guide_label === "string" ? metadata.guide_label : "Guide 1 V2 - Diagnostic & Passerelle vers la 3e"),
    pageReference: snapshotDay?.page_reference ?? (typeof metadata.page_reference === "string" ? metadata.page_reference : null),
    exerciseNumbers,
    recommendedPart: normalizeRecommendedValue(snapshotDay?.recommended_part ?? "Guide papier"),
    recommendedLevel: normalizeRecommendedValue(snapshotDay?.recommended_level ?? "Guide papier"),
    lessonAi: snapshotDay?.lesson_ai ?? null,
    followUpQuestions: snapshotDay?.follow_up_questions ?? [],
    isFinalValidation: snapshotDay?.is_final_validation ?? (day.day_number === 14),
    includedInPlan: snapshotDay != null,
    items,
  };
}

export async function persistPretProgramSnapshotFromAnalysis(input: {
  studentId: string;
  analysisId: string;
  latestDiagnosticAnalysis: Awaited<ReturnType<typeof getLatestDiagnosticAnalysisForStudent>>;
}) {
  const supabase = createAdminClient();
  const definition = await getPretProgramDefinition(supabase);
  if (!definition) return null;

  const diagnosticTopicResults = parseDiagnosticTopicResults(input.latestDiagnosticAnalysis);
  if (diagnosticTopicResults.length === 0) return null;
  const plan = buildPersonalizedRevisionPlan(definition.days, diagnosticTopicResults);
  const snapshot = buildSnapshotFromPlan(plan, input.analysisId);

  const enrollmentQuery = await supabase
    .from("student_program_enrollments")
    .select("id, status, plan_snapshot")
    .eq("student_id", input.studentId)
    .eq("program_id", definition.programId)
    .maybeSingle();
  if (enrollmentQuery.error) throw enrollmentQuery.error;

  const existingStatus = enrollmentQuery.data?.status;
  if (existingStatus === "active" || existingStatus === "completed" || existingStatus === "paused") {
    return parsePlanSnapshot(enrollmentQuery.data?.plan_snapshot) ?? snapshot;
  }

  const now = new Date().toISOString();
  const enrollmentId = enrollmentQuery.data?.id ?? randomUUID();
  const { error: enrollmentError } = await supabase.from("student_program_enrollments").upsert({
    id: enrollmentId,
    student_id: input.studentId,
    program_id: definition.programId,
    status: "planned",
    started_at: enrollmentQuery.data ? undefined : now,
    updated_at: now,
    plan_snapshot: snapshot,
  }, { onConflict: "student_id,program_id" });
  if (enrollmentError) throw enrollmentError;

  const { error: deleteDayProgressError } = await supabase
    .from("student_program_day_progress")
    .delete()
    .eq("enrollment_id", enrollmentId);
  if (deleteDayProgressError) throw deleteDayProgressError;

  const { error: deleteItemProgressError } = await supabase
    .from("student_program_item_progress")
    .delete()
    .eq("enrollment_id", enrollmentId);
  if (deleteItemProgressError) throw deleteItemProgressError;

  if (snapshot.selected_days.length > 0) {
    const { error: insertDayProgressError } = await supabase.from("student_program_day_progress").insert(
      snapshot.selected_days.map((day) => ({
        id: randomUUID(),
        enrollment_id: enrollmentId,
        program_day_id: day.program_day_id,
        status: "not_started",
        session_index: day.session_index,
        snapshot_payload: day,
        needs_review: false,
        created_at: now,
        updated_at: now,
      })),
    );
    if (insertDayProgressError) throw insertDayProgressError;
  }

  return snapshot;
}

export async function getPretProgramState(studentId: string) {
  const [{ student, supabase }, latestAnalysis, latestDiagnosticAnalysis, submissions] = await Promise.all([
    requireOwnedStudent(studentId),
    getLatestAnalysisForStudent(studentId),
    getLatestDiagnosticAnalysisForStudent(studentId),
    listSubmissionsWithAnalyses(studentId),
  ]);
  const latestSubmission = submissions[0] ?? null;

  let definition;
  try {
    definition = await getPretProgramDefinition(supabase as never);
  } catch (error) {
    if (isMissingProgramError(error)) return emptyState(latestAnalysis, latestDiagnosticAnalysis, latestSubmission);
    throw error;
  }
  if (!definition) return emptyState(latestAnalysis, latestDiagnosticAnalysis, latestSubmission);

  const enrollmentQuery = await supabase
    .from("student_program_enrollments")
    .select("id, status, plan_snapshot")
    .eq("student_id", student.id)
    .eq("program_id", definition.programId)
    .maybeSingle();
  if (enrollmentQuery.error) {
    if (isMissingProgramError(enrollmentQuery.error)) return emptyState(latestAnalysis, latestDiagnosticAnalysis, latestSubmission);
    throw enrollmentQuery.error;
  }

  const enrollment = enrollmentQuery.data;
  const enrollmentId = enrollment?.id ?? null;
  const enrollmentStatus = isPretEnrollmentStatus(enrollment?.status) ? enrollment.status : null;
  const persistedSnapshot = parsePlanSnapshot(enrollment?.plan_snapshot);

  let dayProgressRows: Array<{ program_day_id: string; status: DayStatus | null; session_index: number | null; snapshot_payload: unknown }> = [];
  let itemProgressRows: Array<{ program_item_id: string; status: DayStatus | null; score: number | null }> = [];

  if (enrollmentId) {
    const [dayProgressQuery, itemProgressQuery] = await Promise.all([
      supabase
        .from("student_program_day_progress")
        .select("program_day_id, status, session_index, snapshot_payload")
        .eq("enrollment_id", enrollmentId)
        .order("session_index", { ascending: true }),
      supabase
        .from("student_program_item_progress")
        .select("program_item_id, status, score")
        .eq("enrollment_id", enrollmentId),
    ]);
    if (dayProgressQuery.error) {
      if (isMissingProgramError(dayProgressQuery.error)) return emptyState(latestAnalysis, latestDiagnosticAnalysis, latestSubmission);
      throw dayProgressQuery.error;
    }
    if (itemProgressQuery.error) {
      if (isMissingProgramError(itemProgressQuery.error)) return emptyState(latestAnalysis, latestDiagnosticAnalysis, latestSubmission);
      throw itemProgressQuery.error;
    }
    dayProgressRows = (dayProgressQuery.data ?? []) as typeof dayProgressRows;
    itemProgressRows = (itemProgressQuery.data ?? []) as typeof itemProgressRows;
  }

  const dayProgressMap = new Map(dayProgressRows.map((row) => [row.program_day_id, row]));
  const itemProgressMap = new Map(itemProgressRows.map((row) => [row.program_item_id, row]));

  let snapshot = persistedSnapshot;
  if (!snapshot && latestDiagnosticAnalysis) {
    const diagnosticTopicResults = parseDiagnosticTopicResults(latestDiagnosticAnalysis);
    if (diagnosticTopicResults.length > 0) {
      snapshot = buildSnapshotFromPlan(buildPersonalizedRevisionPlan(definition.days, diagnosticTopicResults), latestDiagnosticAnalysis.id ?? null);
    }
  }

  const snapshotDayMap = new Map(
    (snapshot?.selected_days ?? []).map((day) => [day.program_day_id, day]),
  );

  const visibleDays = snapshot
    ? snapshot.selected_days
      .map((snapshotDay) => {
        const baseDay = definition.days.find((day) => day.id === snapshotDay.program_day_id);
        if (!baseDay) return null;
        return buildDayFromDefinition(baseDay, snapshotDay, dayProgressMap.get(baseDay.id)?.status, itemProgressMap);
      })
      .filter((day): day is PretProgramDay => day != null)
    : definition.days.map((day) => buildDayFromDefinition(day, snapshotDayMap.get(day.id) ?? null, dayProgressMap.get(day.id)?.status, itemProgressMap));

  const completedDays = visibleDays.filter((day) => day.status === "completed").length;
  const currentDay = visibleDays.find((day) => day.status !== "completed") ?? visibleDays[visibleDays.length - 1] ?? null;
  const diagnosticReviewTopics = latestDiagnosticAnalysis
    ? parseDiagnosticTopicResults(latestDiagnosticAnalysis)
      .filter((item: { mastery: "maitrise" | "a_renforcer" | "a_reprendre" }) => item.mastery !== "maitrise")
      .map((item: { topicSlug: string }) => item.topicSlug)
    : [];
  const reviewTopics = snapshot?.focus_topic_slugs.length
    ? snapshot.focus_topic_slugs
    : latestDiagnosticAnalysis
      ? diagnosticReviewTopics
      : latestAnalysis?.notions_a_revoir ?? [];

  return {
    available: true,
    enrolled: enrollmentStatus === "active",
    enrollmentId,
    enrollmentStatus,
    hasPlanSnapshot: Boolean(snapshot),
    programId: definition.programId,
    programTitle: definition.programTitle,
    totalDays: snapshot?.selected_days.length ?? definition.totalDays,
    completedDays,
    progressPercent: visibleDays.length === 0 ? 0 : Math.round((completedDays / visibleDays.length) * 100),
    currentDayNumber: currentDay?.day_number ?? null,
    currentDay,
    latestAnalysis,
    latestDiagnosticAnalysis,
    latestSubmission,
    hasDiagnostic: Boolean(latestDiagnosticAnalysis),
    requiresDiagnostic: !latestDiagnosticAnalysis && !Boolean(enrollmentId),
    selectedDayNumbers: snapshot?.selected_day_numbers ?? visibleDays.map((day) => day.day_number),
    reviewTopics,
    days: visibleDays,
  } satisfies PretProgramState;
}

export async function startPretProgram(studentId: string) {
  const { student } = await requireOwnedStudent(studentId);
  const admin = createAdminClient();
  const definition = await getPretProgramDefinition(admin);
  if (!definition) {
    const error = new Error("Le programme 14 jours n'est pas encore installé dans Supabase.") as Error & { status?: number };
    error.status = 503;
    throw error;
  }

  let enrollment = await admin
    .from("student_program_enrollments")
    .select("id, status, plan_snapshot")
    .eq("student_id", student.id)
    .eq("program_id", definition.programId)
    .maybeSingle();
  if (enrollment.error) throw enrollment.error;

  if (!enrollment.data?.plan_snapshot) {
    const latestDiagnosticAnalysis = await getLatestDiagnosticAnalysisForStudent(student.id);
    if (!latestDiagnosticAnalysis) {
      const error = new Error("Le diagnostic doit être terminé avant de démarrer le programme.") as Error & { status?: number };
      error.status = 409;
      throw error;
    }
    await persistPretProgramSnapshotFromAnalysis({
      studentId: student.id,
      analysisId: String(latestDiagnosticAnalysis.id),
      latestDiagnosticAnalysis,
    });
    enrollment = await admin
      .from("student_program_enrollments")
      .select("id, status, plan_snapshot")
      .eq("student_id", student.id)
      .eq("program_id", definition.programId)
      .maybeSingle();
    if (enrollment.error) throw enrollment.error;
  }

  if (!enrollment.data) {
    const error = new Error("Impossible de préparer le programme personnalisé.") as Error & { status?: number };
    error.status = 500;
    throw error;
  }

  if (enrollment.data.status === "active" || enrollment.data.status === "completed") {
    return enrollment.data.id;
  }

  const snapshot = parsePlanSnapshot(enrollment.data.plan_snapshot);
  if (!snapshot) {
    const error = new Error("Le plan personnalisé n'est pas encore prêt.") as Error & { status?: number };
    error.status = 409;
    throw error;
  }

  const now = new Date().toISOString();
  const enrollmentId = enrollment.data.id;
  const { error: activateError } = await admin
    .from("student_program_enrollments")
    .update({
      status: "active",
      started_at: now,
      updated_at: now,
    })
    .eq("id", enrollmentId)
    .in("status", ["planned", "paused"]);
  if (activateError) throw activateError;

  await addNotificationIfAbsent({
    userId: student.parent_user_id,
    studentId: student.id,
    type: "rappel_programme_demarre",
    message: `${student.first_name} peut commencer son programme personnalisé. La première séance est prête dans le guide.`,
    dedupeKey: `programme-demarre:${enrollmentId}`,
  });

  const selectedDayIds = new Set(snapshot.selected_days.map((day) => day.program_day_id));
  const selectedItemIds = definition.days
    .filter((day) => selectedDayIds.has(day.id))
    .flatMap((day) => day.items.filter((item) => item.active && item.item_type !== "guided_example").map((item) => item.id));

  const existingItems = await admin
    .from("student_program_item_progress")
    .select("program_item_id")
    .eq("enrollment_id", enrollmentId);
  if (existingItems.error) throw existingItems.error;
  const existingItemIds = new Set((existingItems.data ?? []).map((item) => item.program_item_id));
  const missingItemIds = selectedItemIds.filter((itemId) => !existingItemIds.has(itemId));

  if (missingItemIds.length > 0) {
    const { error: insertItemsError } = await admin.from("student_program_item_progress").insert(
      missingItemIds.map((programItemId) => ({
        id: randomUUID(),
        enrollment_id: enrollmentId,
        program_item_id: programItemId,
        status: "not_started",
        attempts: 0,
        created_at: now,
        updated_at: now,
      })),
    );
    if (insertItemsError) throw insertItemsError;
  }

  return enrollmentId;
}

export async function updatePretProgramProgressAfterAnalysis(input: {
  enrollmentId?: string | null;
  submissionId: string;
  studentId: string;
  programDayId?: string | null;
  programItemId?: string | null;
  score: number | null;
  status: "reussi" | "partiel" | "a_revoir";
}) {
  if (!input.programDayId && !input.programItemId) return;
  const supabase = createAdminClient();

  let enrollmentId = input.enrollmentId ?? null;
  if (!enrollmentId) {
    const enrollmentQuery = await supabase
      .from("student_program_enrollments")
      .select("id")
      .eq("student_id", input.studentId)
      .in("status", ["planned", "active", "paused", "completed"])
      .limit(1)
      .maybeSingle();
    if (enrollmentQuery.error) {
      if (isMissingProgramError(enrollmentQuery.error)) return;
      throw enrollmentQuery.error;
    }
    enrollmentId = enrollmentQuery.data?.id ?? null;
  }
  if (!enrollmentId) return;

  const itemStatus: DayStatus = input.status === "reussi" ? "completed" : input.status === "partiel" ? "in_progress" : "needs_review";
  const dayStatus: DayStatus = input.status === "reussi" ? "completed" : input.status === "partiel" ? "in_progress" : "needs_review";

  if (input.programItemId) {
    const itemUpsert = await supabase.from("student_program_item_progress").upsert({
      id: randomUUID(),
      enrollment_id: enrollmentId,
      program_item_id: input.programItemId,
      status: itemStatus,
      score: input.score,
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "enrollment_id,program_item_id" });
    if (itemUpsert.error && !isMissingProgramError(itemUpsert.error)) throw itemUpsert.error;
  }

  if (input.programDayId) {
    const dayUpsert = await supabase.from("student_program_day_progress").upsert({
      id: randomUUID(),
      enrollment_id: enrollmentId,
      program_day_id: input.programDayId,
      status: dayStatus,
      started_at: new Date().toISOString(),
      completed_at: input.status === "reussi" ? new Date().toISOString() : null,
      last_score: input.score,
      needs_review: input.status === "a_revoir",
      updated_at: new Date().toISOString(),
    }, { onConflict: "enrollment_id,program_day_id" });
    if (dayUpsert.error && !isMissingProgramError(dayUpsert.error)) throw dayUpsert.error;
  }

  const submissionUpdate = await supabase
    .from("work_submissions")
    .update({
      program_day_id: input.programDayId ?? null,
      program_item_id: input.programItemId ?? null,
    })
    .eq("id", input.submissionId);
  if (submissionUpdate.error && !isMissingProgramError(submissionUpdate.error)) throw submissionUpdate.error;
}
