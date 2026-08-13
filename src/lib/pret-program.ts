import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLatestAnalysisForStudent, listSubmissionsWithAnalyses, requireOwnedStudent } from "@/lib/app-data";

const PRET_PROGRAM_SLUG = "pret-pour-la-3e-14-jours";

type DayStatus = "not_started" | "in_progress" | "completed" | "needs_review";

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
  items: PretProgramItem[];
};

export type PretProgramState = {
  available: boolean;
  enrolled: boolean;
  enrollmentId: string | null;
  programId: string | null;
  programTitle: string;
  totalDays: number;
  completedDays: number;
  progressPercent: number;
  currentDayNumber: number | null;
  currentDay: PretProgramDay | null;
  latestAnalysis: Awaited<ReturnType<typeof getLatestAnalysisForStudent>> | null;
  latestSubmission: Awaited<ReturnType<typeof listSubmissionsWithAnalyses>>[number] | null;
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

function emptyState(latestAnalysis: PretProgramState["latestAnalysis"], latestSubmission: PretProgramState["latestSubmission"]): PretProgramState {
  return {
    available: false,
    enrolled: false,
    enrollmentId: null,
    programId: null,
    programTitle: "PRÊT POUR LA 3e — MATHS BÉNIN",
    totalDays: 14,
    completedDays: 0,
    progressPercent: 0,
    currentDayNumber: null,
    currentDay: null,
    latestAnalysis,
    latestSubmission,
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

export async function getPretProgramState(studentId: string) {
  const [{ student, supabase }, latestAnalysis, submissions] = await Promise.all([
    requireOwnedStudent(studentId),
    getLatestAnalysisForStudent(studentId),
    listSubmissionsWithAnalyses(studentId),
  ]);
  const latestSubmission = submissions[0] ?? null;

  const programQuery = await supabase
    .from("learning_programs")
    .select("id, title, total_days")
    .eq("slug", PRET_PROGRAM_SLUG)
    .eq("active", true)
    .maybeSingle();

  if (programQuery.error) {
    if (isMissingProgramError(programQuery.error)) return emptyState(latestAnalysis, latestSubmission);
    throw programQuery.error;
  }
  if (!programQuery.data) return emptyState(latestAnalysis, latestSubmission);

  const program = programQuery.data;
  const enrollmentQuery = await supabase
    .from("student_program_enrollments")
    .select("id, status, program_id")
    .eq("student_id", student.id)
    .eq("program_id", program.id)
    .maybeSingle();

  if (enrollmentQuery.error) {
    if (isMissingProgramError(enrollmentQuery.error)) return emptyState(latestAnalysis, latestSubmission);
    throw enrollmentQuery.error;
  }

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
    .eq("program_id", program.id)
    .eq("active", true)
    .order("day_number");

  if (daysQuery.error) {
    if (isMissingProgramError(daysQuery.error)) return emptyState(latestAnalysis, latestSubmission);
    throw daysQuery.error;
  }

  const enrollment = enrollmentQuery.data;
  const enrollmentId = enrollment?.id ?? null;
  let dayProgressRows: Array<{ program_day_id: string; status: DayStatus | null }> = [];
  let itemProgressRows: Array<{ program_item_id: string; status: DayStatus | null; score: number | null }> = [];

  if (enrollmentId) {
    const [dayProgressQuery, itemProgressQuery] = await Promise.all([
      supabase
        .from("student_program_day_progress")
        .select("program_day_id, status")
        .eq("enrollment_id", enrollmentId),
      supabase
        .from("student_program_item_progress")
        .select("program_item_id, status, score")
        .eq("enrollment_id", enrollmentId),
    ]);

    if (dayProgressQuery.error) {
      if (isMissingProgramError(dayProgressQuery.error)) return emptyState(latestAnalysis, latestSubmission);
      throw dayProgressQuery.error;
    }
    if (itemProgressQuery.error) {
      if (isMissingProgramError(itemProgressQuery.error)) return emptyState(latestAnalysis, latestSubmission);
      throw itemProgressQuery.error;
    }
    dayProgressRows = dayProgressQuery.data ?? [];
    itemProgressRows = itemProgressQuery.data ?? [];
  }

  const dayProgressMap = new Map(dayProgressRows.map((row) => [row.program_day_id, row.status]));
  const itemProgressMap = new Map(itemProgressRows.map((row) => [row.program_item_id, row]));

  const days = (daysQuery.data ?? []).map((day) => {
    const items = ((day.learning_program_items as Array<Record<string, unknown>> | null) ?? [])
      .sort((a, b) => Number(a.item_order ?? 0) - Number(b.item_order ?? 0))
      .map((item) => {
        const progress = itemProgressMap.get(String(item.id));
        return {
          id: String(item.id),
          item_type: String(item.item_type),
          item_order: Number(item.item_order ?? 0),
          title: item.title == null ? null : String(item.title),
          prompt: String(item.prompt ?? ""),
          guide_reference: String(item.guide_reference ?? ""),
          correction_reference: item.correction_reference == null ? null : String(item.correction_reference),
          difficulty_label: item.difficulty_label == null ? null : String(item.difficulty_label),
          active: Boolean(item.active ?? true),
          progressStatus: (progress?.status ?? "not_started") as DayStatus,
          score: progress?.score == null ? null : Number(progress.score),
        } satisfies PretProgramItem;
      });
    const actionableItems = items.filter((item) => item.item_type !== "guided_example");
    const completedItems = actionableItems.filter((item) => item.progressStatus === "completed").length;
    const guideReferences = [...new Set(items.map((item) => item.guide_reference).filter(Boolean))];
    return {
      id: String(day.id),
      day_number: Number(day.day_number ?? 0),
      day_kind: String(day.day_kind ?? "lesson"),
      title: String(day.title ?? ""),
      objective: day.objective == null ? null : String(day.objective),
      estimated_minutes_min: day.estimated_minutes_min == null ? null : Number(day.estimated_minutes_min),
      estimated_minutes_max: day.estimated_minutes_max == null ? null : Number(day.estimated_minutes_max),
      active: Boolean(day.active ?? true),
      guideReferences,
      status: computeDayStatus(items, dayProgressMap.get(String(day.id))),
      completedItems,
      actionableItems: actionableItems.length,
      items,
    } satisfies PretProgramDay;
  });

  const completedDays = days.filter((day) => day.status === "completed").length;
  const currentDay = days.find((day) => day.status !== "completed") ?? days[days.length - 1] ?? null;

  return {
    available: true,
    enrolled: Boolean(enrollmentId),
    enrollmentId,
    programId: program.id,
    programTitle: program.title,
    totalDays: Number(program.total_days ?? 14),
    completedDays,
    progressPercent: days.length === 0 ? 0 : Math.round((completedDays / days.length) * 100),
    currentDayNumber: currentDay?.day_number ?? null,
    currentDay,
    latestAnalysis,
    latestSubmission,
    reviewTopics: latestAnalysis?.notions_a_revoir ?? [],
    days,
  } satisfies PretProgramState;
}

export async function startPretProgram(studentId: string) {
  const { supabase } = await requireOwnedStudent(studentId);
  const rpc = await supabase.rpc("start_pret_pour_la_3e_14_jours", { p_student_id: studentId });
  if (rpc.error) {
    if (isMissingProgramError(rpc.error)) {
      const error = new Error("Le programme 14 jours n'est pas encore installé dans Supabase.") as Error & { status?: number };
      error.status = 503;
      throw error;
    }
    throw rpc.error;
  }
  return rpc.data;
}

export async function updatePretProgramProgressAfterAnalysis(input: {
  enrollmentId?: string | null;
  submissionId: string;
  studentId: string;
  programDayId?: string | null;
  programItemId?: string | null;
  score: number;
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
