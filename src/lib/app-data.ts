import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeLicenseExpiry, getLicenseDaysRemaining, isLicenseCurrentlyValid, isLicenseExpiringSoon, normalizeLicenseDurationDays } from "@/lib/licenses";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getAIProvider } from "@/lib/env";
import { topicLabels } from "@/lib/topics";

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

const MARKETOU_PROVISION_SOURCE = "marketou";
const MARKETOU_PRODUCT = "ÉLAN Scolaire — Accès Marketou V1";
const MARKETOU_MAX_STUDENTS = 2;

function createHttpError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export function generateLicensePlainText() {
  const pieces = [randomBytes(2).toString("hex").toUpperCase(), randomBytes(2).toString("hex").toUpperCase(), randomBytes(2).toString("hex").toUpperCase()];
  return `ELAN-3E-${pieces.join("-")}`;
}

async function findTopicBySlug(topicSlug: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("topics").select("id, slug, name").eq("slug", topicSlug).maybeSingle();
  if (error) throw error;
  return data;
}

async function requireAuthenticatedContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw createHttpError(401, "Unauthorized");
  return { supabase, user };
}

async function assertPremiumAccess(userId: string) {
  const supabase = createAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_license_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.active_license_id) throw createHttpError(403, "Premium access required.");
  const { data: license, error: licenseError } = await supabase
    .from("license_keys")
    .select("status, expires_at")
    .eq("id", profile.active_license_id)
    .maybeSingle();
  if (licenseError) throw licenseError;
  if (!isLicenseCurrentlyValid(license)) throw createHttpError(403, "Premium access expired.");
  return license;
}

export async function requireOwnedStudent(studentId: string) {
  const normalizedStudentId = studentId.trim();
  if (!normalizedStudentId) throw createHttpError(400, "Student ID is required.");
  const { supabase, user } = await requireAuthenticatedContext();
  await assertPremiumAccess(user.id);
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", normalizedStudentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw createHttpError(403, "Forbidden");
  return { supabase, user, student: data };
}

export async function listStudentsForParent(parentUserId: string) {
  const { supabase, user } = await requireAuthenticatedContext();
  if (user.id !== parentUserId) throw createHttpError(403, "Forbidden");
  await assertPremiumAccess(user.id);
  const { data, error } = await supabase.from("students").select("*").eq("parent_user_id", parentUserId).order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function listNotifications(userId: string) {
  const { supabase, user } = await requireAuthenticatedContext();
  if (user.id !== userId) throw createHttpError(403, "Forbidden");
  await assertPremiumAccess(user.id);
  const { data, error } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(12);
  if (error) throw error;
  return data ?? [];
}

export async function getReminderPreference(studentId: string) {
  const { supabase } = await requireOwnedStudent(studentId);
  const { data, error } = await supabase
    .from("reminder_preferences")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStudent(studentId: string) {
  const { student } = await requireOwnedStudent(studentId);
  return student;
}

export async function setStudentCurrentTopic(studentId: string, areaSlug: string, topicSlug: string) {
  const { supabase } = await requireOwnedStudent(studentId);
  const { data, error } = await supabase
    .from("students")
    .update({ current_area_slug: areaSlug, current_topic_slug: topicSlug })
    .eq("id", studentId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateStudentSettings(studentId: string, targetMinutes: number, studyDays: number[]) {
  const { supabase } = await requireOwnedStudent(studentId);
  const { data, error } = await supabase
    .from("students")
    .update({ target_minutes: targetMinutes, study_days: studyDays })
    .eq("id", studentId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getExercisesByTopic(topicSlug: string) {
  const topic = await findTopicBySlug(topicSlug);
  if (!topic) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("exercises").select("*").eq("topic_id", topic.id).order("estimated_minutes");
  if (error) throw error;
  return data ?? [];
}

export async function getProgressForStudent(studentId: string) {
  const { supabase } = await requireOwnedStudent(studentId);
  const { data, error } = await supabase.from("student_topic_progress").select("*").eq("student_id", studentId);
  if (error) throw error;
  const progress = data ?? [];
  const topicIds = [...new Set(progress.map((item) => item.topic_id).filter(Boolean))];
  if (topicIds.length === 0) return progress.map((item) => ({ ...item, topic_slug: null, topic_name: null }));
  const { data: topics, error: topicsError } = await supabase.from("topics").select("id, slug, name").in("id", topicIds);
  if (topicsError) throw topicsError;
  const topicMap = new Map((topics ?? []).map((topic) => [topic.id, topic]));
  return progress.map((item) => ({
    ...item,
    topic_slug: topicMap.get(item.topic_id)?.slug ?? null,
    topic_name: topicMap.get(item.topic_id)?.name ?? null,
  }));
}

function getMasteryFromScore(score: number) {
  if (score >= 80) return "maitrise";
  if (score < 45) return "a_reprendre";
  return "a_renforcer";
}

export async function upsertTopicProgress(studentId: string, topicSlug: string, score: number, mastery = getMasteryFromScore(score)) {
  const topic = await findTopicBySlug(topicSlug);
  if (!topic) {
    console.warn("[progress] Topic not found for slug", { studentId, topicSlug });
    return;
  }
  const supabase = createAdminClient();
  const updatedAt = new Date().toISOString();
  const { data: existingRows, error: lookupError } = await supabase
    .from("student_topic_progress")
    .select("id")
    .eq("student_id", studentId)
    .eq("topic_id", topic.id)
    .limit(1);
  if (lookupError) throw lookupError;

  const progressPayload = {
    score,
    mastery,
    updated_at: updatedAt,
  };

  if ((existingRows ?? []).length > 0) {
    const { error: updateError } = await supabase
      .from("student_topic_progress")
      .update(progressPayload)
      .eq("student_id", studentId)
      .eq("topic_id", topic.id);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase.from("student_topic_progress").insert({
      id: randomUUID(),
      student_id: studentId,
      topic_id: topic.id,
      ...progressPayload,
    });
    if (insertError) throw insertError;
  }

}

export async function getTopicProgressSnapshot(studentId: string) {
  const progress = await getProgressForStudent(studentId);
  return new Map(
    progress
      .filter((item) => typeof item.topic_slug === "string" && item.topic_slug.length > 0)
      .map((item) => [String(item.topic_slug), Number(item.score ?? 0)]),
  );
}

export async function getLatestAnalysisForStudent(studentId: string) {
  const { supabase } = await requireOwnedStudent(studentId);
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("*, work_submissions!inner(student_id)")
    .eq("work_submissions.student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listSubmissionsForStudent(studentId: string) {
  const { supabase } = await requireOwnedStudent(studentId);
  const { data, error } = await supabase.from("work_submissions").select("*").eq("student_id", studentId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listSubmissionsWithAnalyses(studentId: string) {
  const { supabase } = await requireOwnedStudent(studentId);
  const { data, error } = await supabase
    .from("work_submissions")
    .select("*, ai_analyses(*), learning_program_items(title, item_type), learning_program_days(day_number, title), annual_week_items(title, item_type), annual_program_weeks(week_number, title)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSubmission(input: {
  id?: string;
  studentId: string;
  exerciseId: string | null;
  comment: string;
  fileNames: string[];
  storedPaths: string[];
  submissionKind?: "practice" | "diagnostic";
  referencePayload?: Record<string, unknown>;
  processingStatus?: "pending" | "processing" | "completed" | "failed";
  processingError?: string | null;
  processingStartedAt?: string | null;
  processingCompletedAt?: string | null;
  programDayId?: string | null;
  programItemId?: string | null;
  annualWeekId?: string | null;
  annualWeekItemId?: string | null;
  validationPayload?: Record<string, unknown>;
}) {
  const { supabase } = await requireOwnedStudent(input.studentId);
  const { data, error } = await supabase
    .from("work_submissions")
    .insert({
      id: input.id ?? randomUUID(),
      student_id: input.studentId,
      exercise_id: input.exerciseId,
      program_day_id: input.programDayId ?? null,
      program_item_id: input.programItemId ?? null,
      annual_week_id: input.annualWeekId ?? null,
      annual_week_item_id: input.annualWeekItemId ?? null,
      comment: input.comment,
      submission_kind: input.submissionKind ?? "practice",
      reference_payload: input.referencePayload ?? {},
      validation_payload: input.validationPayload ?? {},
      processing_status: input.processingStatus ?? "completed",
      processing_error: input.processingError ?? null,
      processing_started_at: input.processingStartedAt ?? null,
      processing_completed_at: input.processingCompletedAt ?? null,
      file_names: input.fileNames,
      storage_paths: input.storedPaths,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getLearningProgramItemForAnalysis(programItemId: string | null | undefined) {
  if (!programItemId) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("learning_program_items")
    .select(`
      id,
      item_type,
      title,
      prompt,
      guide_reference,
      correction_reference,
      difficulty_label,
      metadata,
      learning_program_days (
        day_number,
        title,
        objective
      )
    `)
    .eq("id", programItemId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const day = Array.isArray(data.learning_program_days)
    ? data.learning_program_days[0]
    : data.learning_program_days;
  return {
    id: String(data.id),
    itemType: String(data.item_type ?? ""),
    title: data.title == null ? null : String(data.title),
    prompt: String(data.prompt ?? ""),
    guideReference: String(data.guide_reference ?? ""),
    correctionReference: data.correction_reference == null ? null : String(data.correction_reference),
    difficultyLabel: data.difficulty_label == null ? null : String(data.difficulty_label),
    metadata: data.metadata ?? {},
    dayNumber: day?.day_number == null ? null : Number(day.day_number),
    dayTitle: day?.title == null ? null : String(day.title),
    dayObjective: day?.objective == null ? null : String(day.objective),
  };
}

export async function getLearningProgramDayReference(programDayId: string | null | undefined) {
  if (!programDayId) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("learning_program_days")
    .select("id, day_number, title, objective, metadata")
    .eq("id", programDayId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: String(data.id),
    dayNumber: data.day_number == null ? null : Number(data.day_number),
    dayTitle: data.title == null ? null : String(data.title),
    objective: data.objective == null ? null : String(data.objective),
    metadata: (data.metadata as Record<string, unknown> | null) ?? {},
  };
}

export async function getAnnualWeekItemForAnalysis(annualWeekItemId: string | null | undefined) {
  if (!annualWeekItemId) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("annual_week_items")
    .select(`
      id,
      item_type,
      title,
      instructions,
      guide_reference,
      page_reference,
      estimated_minutes,
      annual_program_weeks!inner (
        id,
        week_number,
        title,
        objective,
        guide_reference,
        page_reference
      ),
      exercises (
        document,
        section,
        exercise_number,
        correction_reference
      )
    `)
    .eq("id", annualWeekItemId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const week = Array.isArray(data.annual_program_weeks)
    ? data.annual_program_weeks[0]
    : data.annual_program_weeks;
  const exercise = Array.isArray(data.exercises)
    ? data.exercises[0]
    : data.exercises;

  const guideReference = data.guide_reference == null
    ? (week?.guide_reference == null ? null : String(week.guide_reference))
    : String(data.guide_reference);
  const pageReference = data.page_reference == null
    ? (week?.page_reference == null ? null : String(week.page_reference))
    : String(data.page_reference);
  const exerciseReference = exercise?.exercise_number == null
    ? null
    : `${String(exercise.document ?? "Guide 2")} · ${String(exercise.section ?? "Exercices")} · exercices ${String(exercise.exercise_number)}`;

  return {
    id: String(data.id),
    itemType: String(data.item_type ?? ""),
    title: data.title == null ? null : String(data.title),
    prompt: data.instructions == null
      ? "Travail realise dans le Guide 2 officiel. Analyse la copie sans inventer le texte exact des exercices."
      : String(data.instructions),
    guideReference: guideReference ?? "Référence du guide en cours de préparation",
    pageReference,
    exerciseReference,
    correctionReference: exercise?.correction_reference == null ? null : String(exercise.correction_reference),
    estimatedMinutes: data.estimated_minutes == null ? null : Number(data.estimated_minutes),
    weekNumber: week?.week_number == null ? null : Number(week.week_number),
    weekTitle: week?.title == null ? null : String(week.title),
    weekObjective: week?.objective == null ? null : String(week.objective),
  };
}

export async function createAnalysis(input: {
  submissionId: string;
  score: number | null;
  status: string;
  pointsForts: string[];
  erreurs: string[];
  notionsARevoir: string[];
  conseilEleve: string;
  conseilParent: string;
  exercicesRecommandes: string[];
  provider: string;
  analysisKind?: "practice" | "diagnostic";
  topicResults?: unknown[];
  nextSteps?: unknown[];
  summaryAi?: string | null;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_analyses")
    .insert({
      id: randomUUID(),
      submission_id: input.submissionId,
      score: input.score,
      status: input.status,
      points_forts: input.pointsForts,
      erreurs: input.erreurs,
      notions_a_revoir: input.notionsARevoir,
      conseil_eleve: input.conseilEleve,
      conseil_parent: input.conseilParent,
      exercices_recommandes: input.exercicesRecommandes,
      analysis_kind: input.analysisKind ?? "practice",
      topic_results: input.topicResults ?? [],
      next_steps: input.nextSteps ?? [],
      summary_ai: input.summaryAi ?? null,
      provider: input.provider,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function addNotification(entry: {
  userId: string;
  type: string;
  message: string;
  studentId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("notifications").insert({
    id: randomUUID(),
    user_id: entry.userId,
    student_id: entry.studentId ?? null,
    type: entry.type,
    message: entry.message,
    metadata: entry.metadata ?? {},
    created_at: new Date().toISOString(),
    read: false,
  });
  if (error) throw error;
}

export async function addNotificationIfAbsent(entry: {
  userId: string;
  type: string;
  message: string;
  studentId?: string | null;
  metadata?: Record<string, unknown>;
  dedupeKey: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", entry.userId)
    .eq("type", entry.type)
    .contains("metadata", { dedupe_key: entry.dedupeKey })
    .limit(1);
  if (error) throw error;
  if ((data ?? []).length > 0) return false;
  await addNotification({
    userId: entry.userId,
    type: entry.type,
    message: entry.message,
    studentId: entry.studentId ?? null,
    metadata: {
      ...(entry.metadata ?? {}),
      dedupe_key: entry.dedupeKey,
    },
  });
  return true;
}

export async function listReminderPreferencesForCron() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reminder_preferences")
    .select("id, student_id, days, hour, active, students!inner(id, first_name, parent_user_id)")
    .eq("active", true);
  if (error) throw error;
  return data ?? [];
}

export async function listLicensesExpiringSoonForCron() {
  const supabase = createAdminClient();
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, active_license_id")
    .not("active_license_id", "is", null);
  if (profileError) throw profileError;
  const profileRows = profiles ?? [];
  const licenseIds = profileRows.map((row) => row.active_license_id).filter(Boolean);
  if (licenseIds.length === 0) return [];
  const { data: licenses, error: licenseError } = await supabase
    .from("license_keys")
    .select("id, status, expires_at")
    .in("id", licenseIds);
  if (licenseError) throw licenseError;
  const licenseMap = new Map((licenses ?? []).map((license) => [license.id, license]));
  return profileRows
    .map((profile) => ({
      profileId: String(profile.id),
      license: profile.active_license_id ? licenseMap.get(profile.active_license_id) ?? null : null,
      daysRemaining: getLicenseDaysRemaining(profile.active_license_id ? licenseMap.get(profile.active_license_id) ?? null : null),
    }))
    .filter((item) => isLicenseExpiringSoon(item.license));
}

export async function listUpcomingExamPlansForCron() {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const deadline = new Date();
  deadline.setUTCDate(deadline.getUTCDate() + 3);
  const deadlineDate = deadline.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("study_plans")
    .select("id, exam_date, student_id, students!inner(id, first_name, parent_user_id)")
    .gte("exam_date", today)
    .lte("exam_date", deadlineDate)
    .order("exam_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createStudyPlan(studentId: string, examDate: string, items: Array<{ dayLabel: string; topic: string; exercises: string }>) {
  const { supabase } = await requireOwnedStudent(studentId);
  const planId = randomUUID();
  const { data, error } = await supabase
    .from("study_plans")
    .insert({ id: planId, student_id: studentId, exam_date: examDate, created_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw error;
  const { error: itemsError } = await supabase.from("study_plan_items").insert(
    items.map((item) => ({
      id: randomUUID(),
        study_plan_id: planId,
        day_label: item.dayLabel,
        topic: item.topic,
        exercises: item.exercises,
        created_at: new Date().toISOString(),
      }))
  );
  if (itemsError) throw itemsError;
  return data;
}

export async function listStudyPlans(studentId: string) {
  const { supabase } = await requireOwnedStudent(studentId);
  const { data, error } = await supabase.from("study_plans").select("*, study_plan_items(*)").eq("student_id", studentId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getProgressSummary(studentId: string) {
  const progress = await getProgressForStudent(studentId);
  const total = progress.length || 1;
  const percentage = Math.round(progress.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / total);
  const mastered = progress
    .filter((item) => item.mastery === "maitrise")
    .map((item) => topicLabels[item.topic_slug] ?? item.topic_name ?? "Notion");
  const weak = progress
    .filter((item) => item.mastery === "a_renforcer")
    .map((item) => topicLabels[item.topic_slug] ?? item.topic_name ?? "Notion");
  return {
    percentage: progress.length === 0 ? 0 : percentage,
    mastered,
    weak,
    progress,
    trackedTopics: progress.length,
  };
}

export async function getRecommendation(student: { id: string; current_topic_slug: string; target_minutes: number }) {
  const progress = await getProgressForStudent(student.id);
  const current = progress.find((item) => item.topic_slug === student.current_topic_slug);
  const weak = [...progress].sort((a, b) => Number(a.score ?? 0) - Number(b.score ?? 0))[0];
  const focusTopic = weak && Number(weak.score ?? 0) < 50 ? weak.topic_slug : student.current_topic_slug;
  const exercises = await getExercisesByTopic(focusTopic);
  const analysis = (await getLatestAnalysisForStudent(student.id)) ?? { conseil_eleve: "Aucun conseil disponible pour le moment." };
  const score = current?.score == null ? null : Number(current.score);
  const safeBand = score == null ? "a demarrer" : score < 50 ? "facile" : score < 70 ? "consolidation" : score < 85 ? "intermediaire" : "defi";
  const band = safeBand;
  return {
    topicSlug: focusTopic,
    topicLabel: topicLabels[focusTopic] ?? "Notion",
    score,
    band,
    estimatedMinutes: Number(student.target_minutes ?? 35),
    exercises,
    lastAdvice: analysis?.conseil_eleve ?? "Continue avec rÃ©gularitÃ©. Une courte sÃ©ance bien faite vaut mieux quâ€™une longue sÃ©ance abandonnÃ©e.",
  };
}

export async function verifyLicense(code: string) {
  const supabase = createAdminClient();
  const normalized = code.trim().toUpperCase();
  const { data: license, error } = await supabase.from("license_keys").select("*").eq("key_hash", hashText(normalized)).maybeSingle();
  if (error) throw error;
  if (!license) return { ok: false as const, reason: "invalide" };
  if (license.status === "disabled") return { ok: false as const, reason: "desactivee" };
  if (license.status === "expired") return { ok: false as const, reason: "expiree" };
  if (license.status === "active") {
    if (!isLicenseCurrentlyValid(license)) return { ok: false as const, reason: "expiree", license };
    return { ok: false as const, reason: "deja_utilisee", license };
  }
  return { ok: true as const, license };
}

export async function activateLicense(code: string, userId: string) {
  const supabase = createAdminClient();
  const normalized = code.trim().toUpperCase();
  const { data: licenseToActivate, error: licenseReadError } = await supabase
    .from("license_keys")
    .select("*")
    .eq("key_hash", hashText(normalized))
    .eq("status", "available")
    .maybeSingle();
  if (licenseReadError) throw licenseReadError;
  if (!licenseToActivate) throw new Error("Cette clé ne peut pas être activée.");
  const activationDate = new Date();
  const now = activationDate.toISOString();
  const expiresAt = computeLicenseExpiry(activationDate, licenseToActivate.license_duration_days).toISOString();
  const { data: existingProfile, error: profileReadError } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (profileReadError) throw profileReadError;
  if (existingProfile) {
    const { error: profileUpdateError } = await supabase.from("profiles").update({ active_license_id: licenseToActivate.id }).eq("id", userId);
    if (profileUpdateError) throw profileUpdateError;
  } else {
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError) throw authError;
    const { error: profileInsertError } = await supabase.from("profiles").insert({
      id: userId,
      role: "parent",
      full_name: String(authUser.user?.user_metadata?.full_name ?? "Parent"),
      email: authUser.user?.email ?? "",
      active_license_id: licenseToActivate.id,
      created_at: now,
    });
    if (profileInsertError) throw profileInsertError;
  }
  const { data: license, error } = await supabase
    .from("license_keys")
    .update({ status: "active", activated_at: now, activated_by: userId, expires_at: expiresAt })
    .eq("id", licenseToActivate.id)
    .eq("status", "available")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!license) throw new Error("Cette clé ne peut pas être activée.");
  const { error: activationError } = await supabase
    .from("license_activations")
    .insert({ id: randomUUID(), license_id: license.id, user_id: userId, activated_at: now, visible_suffix: license.key_suffix });
  if (activationError) throw activationError;
  return license;
}

export async function createStudent(input: {
  parentUserId: string;
  firstName: string;
  level: string;
  school?: string;
  currentAreaSlug: string;
  currentTopicSlug: string;
  objective: string;
  targetMinutes: number;
  studyDays: number[];
}) {
  const supabase = createAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_license_id")
    .eq("id", input.parentUserId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.active_license_id) throw createHttpError(403, "Aucune licence active n'est associée à ce parent.");

  const { data: license, error: licenseError } = await supabase
    .from("license_keys")
    .select("id, max_students, status, expires_at")
    .eq("id", profile.active_license_id)
    .maybeSingle();
  if (licenseError) throw licenseError;
  if (!license || !isLicenseCurrentlyValid(license)) throw createHttpError(403, "La licence Elan Plus doit être active pour ajouter un élève.");

  const { count, error: countError } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("parent_user_id", input.parentUserId);
  if (countError) throw countError;
  if ((count ?? 0) >= Number(license.max_students ?? 0)) {
    throw createHttpError(409, "La limite d'élèves pour cette licence est atteinte.");
  }

  const { data, error } = await supabase
    .from("students")
    .insert({
      id: randomUUID(),
      parent_user_id: input.parentUserId,
      first_name: input.firstName,
      level: input.level,
      school: input.school || null,
      current_area_slug: input.currentAreaSlug,
      current_topic_slug: input.currentTopicSlug,
      objective: input.objective,
      target_minutes: input.targetMinutes,
      study_days: input.studyDays,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createProfile(input: { id: string; email: string; fullName: string; role?: string; signupSource?: string | null }) {
  const supabase = createAdminClient();
  const payload = {
    id: input.id,
    email: input.email,
    full_name: input.fullName,
    role: input.role ?? "parent",
    created_at: new Date().toISOString(),
    ...(input.signupSource !== undefined ? { signup_source: input.signupSource } : {}),
  };
  const { error } = await supabase.from("profiles").upsert(payload);
  if (error) throw error;
}

export async function provisionMarketouAccessForUser(userId: string) {
  const supabase = createAdminClient();
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const expiresAt = computeLicenseExpiry(nowDate, 365).toISOString();
  let hasValidPremiumAccess = false;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, active_license_id, signup_source")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;

  if (profile?.active_license_id) {
    const { data: activeLicense, error: activeLicenseError } = await supabase
      .from("license_keys")
      .select("*")
      .eq("id", profile.active_license_id)
      .maybeSingle();
    if (activeLicenseError) throw activeLicenseError;
    if (isLicenseCurrentlyValid(activeLicense)) {
      hasValidPremiumAccess = true;
      return { license: activeLicense, created: false as const, reason: "existing_premium" as const };
    }
  }

  const { data: existingMarketouLicense, error: existingMarketouError } = await supabase
    .from("license_keys")
    .select("*")
    .eq("provision_source", MARKETOU_PROVISION_SOURCE)
    .eq("provision_reference", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingMarketouError) throw existingMarketouError;

  if (existingMarketouLicense) {
    if (!hasValidPremiumAccess && profile?.active_license_id !== existingMarketouLicense.id) {
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ active_license_id: existingMarketouLicense.id })
        .eq("id", userId);
      if (profileUpdateError) throw profileUpdateError;
    }
    return { license: existingMarketouLicense, created: false as const, reason: "existing_marketou" as const };
  }

  if (!profile) {
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError) throw authError;
    await createProfile({
      id: userId,
      email: authUser.user?.email ?? "",
      fullName: String(authUser.user?.user_metadata?.full_name ?? "Parent"),
      role: "parent",
      signupSource: MARKETOU_PROVISION_SOURCE,
    });
  } else if (!profile.signup_source) {
    const { error: profileSourceError } = await supabase
      .from("profiles")
      .update({ signup_source: MARKETOU_PROVISION_SOURCE })
      .eq("id", userId)
      .is("signup_source", null);
    if (profileSourceError) throw profileSourceError;
  }

  const plainText = generateLicensePlainText();
  const insertPayload = {
    id: randomUUID(),
    key_hash: hashText(plainText),
    key_prefix: "ELAN-3E",
    key_suffix: plainText.slice(-4),
    product: MARKETOU_PRODUCT,
    status: "active",
    max_students: MARKETOU_MAX_STUDENTS,
    license_duration_days: 365,
    created_at: now,
    activated_at: now,
    activated_by: userId,
    expires_at: expiresAt,
    provision_source: MARKETOU_PROVISION_SOURCE,
    provision_reference: userId,
  };

  const { data: insertedLicense, error: insertLicenseError } = await supabase
    .from("license_keys")
    .insert(insertPayload)
    .select("*")
    .maybeSingle();

  if (insertLicenseError) {
    const isDuplicate = "code" in insertLicenseError && insertLicenseError.code === "23505";
    if (!isDuplicate) throw insertLicenseError;
    const { data: conflictLicense, error: conflictError } = await supabase
      .from("license_keys")
      .select("*")
      .eq("provision_source", MARKETOU_PROVISION_SOURCE)
      .eq("provision_reference", userId)
      .maybeSingle();
    if (conflictError) throw conflictError;
    if (!conflictLicense) throw insertLicenseError;
    if (!hasValidPremiumAccess && profile?.active_license_id !== conflictLicense.id) {
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ active_license_id: conflictLicense.id })
        .eq("id", userId);
      if (profileUpdateError) throw profileUpdateError;
    }
    return { license: conflictLicense, created: false as const, reason: "existing_marketou" as const };
  }

  if (!insertedLicense) throw new Error("Impossible de provisionner l’accès Marketou.");

  const { error: profileLinkError } = await supabase
    .from("profiles")
    .update({ active_license_id: insertedLicense.id })
    .eq("id", userId);
  if (profileLinkError) throw profileLinkError;

  const { error: activationError } = await supabase
    .from("license_activations")
    .insert({
      id: randomUUID(),
      license_id: insertedLicense.id,
      user_id: userId,
      activated_at: now,
      visible_suffix: insertedLicense.key_suffix,
    });
  if (activationError) throw activationError;

  return { license: insertedLicense, created: true as const, reason: "created_marketou" as const };
}

type CreateLicenseBatchOptions = {
  actorUserId?: string;
  orderReference?: string | null;
  product?: string | null;
  maxStudents?: number | null;
  durationDays?: number | null;
};

function normalizeCreateLicenseBatchArgs(
  actorUserIdOrOptions?: string | CreateLicenseBatchOptions,
  maybeOptions: CreateLicenseBatchOptions = {},
): CreateLicenseBatchOptions {
  if (typeof actorUserIdOrOptions === "string") return { ...maybeOptions, actorUserId: actorUserIdOrOptions };
  return actorUserIdOrOptions ?? maybeOptions;
}

export async function createLicenseBatch(count: number, actorUserIdOrOptions?: string | CreateLicenseBatchOptions, maybeOptions: CreateLicenseBatchOptions = {}) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const options = normalizeCreateLicenseBatchArgs(actorUserIdOrOptions, maybeOptions);
  const normalizedDurationDays = normalizeLicenseDurationDays(options.durationDays);
  const normalizedMaxStudents = Number.isFinite(options.maxStudents) && Number(options.maxStudents) > 0
    ? Math.trunc(Number(options.maxStudents))
    : 2;
  const normalizedProduct = options.product?.trim() || "Réussir les Maths 3e";
  const normalizedOrderReference = options.orderReference?.trim() || null;

  if (normalizedOrderReference && count !== 1) {
    throw createHttpError(400, "Une licence provisionnée avec order_reference doit être créée individuellement.");
  }

  const generated = Array.from({ length: count }).map(() => {
    const plainText = generateLicensePlainText();
    return {
      id: randomUUID(),
      key_hash: hashText(plainText),
      key_prefix: "ELAN-3E",
      key_suffix: plainText.slice(-4),
      product: normalizedProduct,
      status: "available",
      max_students: normalizedMaxStudents,
      license_duration_days: normalizedDurationDays,
      order_reference: normalizedOrderReference,
      created_at: now,
      plainText,
    };
  });
  const { error } = await supabase.from("license_keys").insert(generated.map((item) => ({
    id: item.id,
    key_hash: item.key_hash,
    key_prefix: item.key_prefix,
    key_suffix: item.key_suffix,
    product: item.product,
    status: item.status,
    max_students: item.max_students,
    license_duration_days: item.license_duration_days,
    order_reference: item.order_reference,
    created_at: item.created_at,
  })));
  if (error) throw error;
  if (options.actorUserId) {
    await supabase.from("admin_audit_logs").insert({
      id: randomUUID(),
      actor_user_id: options.actorUserId,
      action: "generate_licenses",
      payload: { quantity: count, order_reference: normalizedOrderReference, max_students: normalizedMaxStudents, license_duration_days: normalizedDurationDays },
      created_at: now,
    });
  }
  return generated;
}

export async function getProvisionedLicenseByOrderReference(orderReference: string) {
  const supabase = createAdminClient();
  const normalized = orderReference.trim();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from("license_keys")
    .select("id, key_suffix, product, status, order_reference")
    .eq("order_reference", normalized)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertReminderPreference(studentId: string, days: number[], hour: string, active: boolean) {
  const { supabase } = await requireOwnedStudent(studentId);
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("reminder_preferences")
    .select("id")
    .eq("student_id", studentId)
    .maybeSingle();
  if (existingError) throw existingError;
  const payload = {
    student_id: studentId,
    days,
    hour,
    active,
    updated_at: now,
  };
  if (existing?.id) {
    const { data, error } = await supabase
      .from("reminder_preferences")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("reminder_preferences")
    .insert({
      id: randomUUID(),
      ...payload,
      created_at: now,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getLatestDiagnosticAnalysisForStudent(studentId: string) {
  const { supabase } = await requireOwnedStudent(studentId);
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("*, work_submissions!inner(student_id, submission_kind)")
    .eq("work_submissions.student_id", studentId)
    .eq("analysis_kind", "diagnostic")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDiagnosticAnalysisBySubmissionId(submissionId: string) {
  const { supabase } = await requireAuthenticatedContext();
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("*, work_submissions!inner(id, student_id, submission_kind, created_at)")
    .eq("submission_id", submissionId)
    .eq("analysis_kind", "diagnostic")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const submission = Array.isArray(data.work_submissions) ? data.work_submissions[0] : data.work_submissions;
  if (!submission) return null;
  await requireOwnedStudent(String(submission.student_id));
  return data;
}

export async function getDiagnosticSubmissionStatus(submissionId: string) {
  const { supabase } = await requireAuthenticatedContext();
  const { data, error } = await supabase
    .from("work_submissions")
    .select("id, student_id, submission_kind, processing_status, processing_error, processing_started_at, processing_completed_at, created_at, validation_status, validation_confidence, validation_reason, validation_payload, validation_provider, validated_at, validation_confirmed_at")
    .eq("id", submissionId)
    .eq("submission_kind", "diagnostic")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  await requireOwnedStudent(String(data.student_id));
  const { data: analysis, error: analysisError } = await supabase
    .from("ai_analyses")
    .select("id, created_at")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (analysisError) throw analysisError;
  return {
    ...data,
    analysis_id: analysis?.id ?? null,
    analysis_created_at: analysis?.created_at ?? null,
  };
}

export async function getPracticeSubmissionStatus(submissionId: string) {
  const { supabase } = await requireAuthenticatedContext();
  const { data, error } = await supabase
    .from("work_submissions")
    .select("id, student_id, submission_kind, processing_status, processing_error, processing_started_at, processing_completed_at, created_at, validation_status, validation_confidence, validation_reason, validation_payload, validation_provider, validated_at, validation_confirmed_at, reference_payload")
    .eq("id", submissionId)
    .eq("submission_kind", "practice")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  await requireOwnedStudent(String(data.student_id));
  const { data: analysis, error: analysisError } = await supabase
    .from("ai_analyses")
    .select("id, created_at")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (analysisError) throw analysisError;
  return {
    ...data,
    analysis_id: analysis?.id ?? null,
    analysis_created_at: analysis?.created_at ?? null,
  };
}

export async function getLatestDiagnosticSubmissionForStudent(studentId: string) {
  const { supabase } = await requireOwnedStudent(studentId);
  const { data, error } = await supabase
    .from("work_submissions")
    .select("id, student_id, submission_kind, processing_status, processing_error, processing_started_at, processing_completed_at, created_at, validation_status, validation_confidence, validation_reason, validation_payload, validation_provider, validated_at, validation_confirmed_at")
    .eq("student_id", studentId)
    .eq("submission_kind", "diagnostic")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLatestPracticeSubmissionForStudent(studentId: string) {
  const { supabase } = await requireOwnedStudent(studentId);
  const { data, error } = await supabase
    .from("work_submissions")
    .select("id, student_id, submission_kind, processing_status, processing_error, processing_started_at, processing_completed_at, created_at, validation_status, validation_confidence, validation_reason, validation_payload, validation_provider, validated_at, validation_confirmed_at")
    .eq("student_id", studentId)
    .eq("submission_kind", "practice")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLatestCompletedDiagnosticSubmissionForStudent(studentId: string) {
  const { supabase } = await requireOwnedStudent(studentId);
  const { data, error } = await supabase
    .from("work_submissions")
    .select("id, student_id, submission_kind, processing_status, processing_error, processing_started_at, processing_completed_at, created_at, validation_status, validation_confidence, validation_reason, validation_payload, validation_provider, validated_at, validation_confirmed_at")
    .eq("student_id", studentId)
    .eq("submission_kind", "diagnostic")
    .eq("processing_status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateSubmissionProcessingStatus(input: {
  submissionId: string;
  processingStatus: "pending" | "processing" | "completed" | "failed";
  processingError?: string | null;
  processingStartedAt?: string | null;
  processingCompletedAt?: string | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("work_submissions")
    .update({
      processing_status: input.processingStatus,
      processing_error: input.processingError ?? null,
      processing_started_at: input.processingStartedAt ?? null,
      processing_completed_at: input.processingCompletedAt ?? null,
    })
    .eq("id", input.submissionId);
  if (error) throw error;
}

export async function updateSubmissionValidation(input: {
  submissionId: string;
  validationStatus?: "MATCH" | "PARTIAL_MATCH" | "MISMATCH" | "UNREADABLE" | null;
  validationConfidence?: "high" | "medium" | "low" | null;
  validationReason?: string | null;
  validationPayload?: Record<string, unknown> | null;
  validationProvider?: string | null;
  validatedAt?: string | null;
  validationConfirmedAt?: string | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("work_submissions")
    .update({
      validation_status: input.validationStatus ?? null,
      validation_confidence: input.validationConfidence ?? null,
      validation_reason: input.validationReason ?? null,
      validation_payload: input.validationPayload ?? {},
      validation_provider: input.validationProvider ?? null,
      validated_at: input.validatedAt ?? null,
      validation_confirmed_at: input.validationConfirmedAt ?? null,
    })
    .eq("id", input.submissionId);
  if (error) throw error;
}

export async function claimDiagnosticSubmissionProcessing(submissionId: string) {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("work_submissions")
    .update({
      processing_status: "processing",
      processing_error: null,
      processing_started_at: startedAt,
      processing_completed_at: null,
    })
    .eq("id", submissionId)
    .eq("submission_kind", "diagnostic")
    .in("processing_status", ["pending", "failed"])
    .select("id, student_id, comment, file_names, storage_paths, processing_status, processing_started_at, validation_status, validation_confirmed_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function claimPracticeSubmissionProcessing(submissionId: string) {
  const supabase = createAdminClient();
  const startedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("work_submissions")
    .update({
      processing_status: "processing",
      processing_error: null,
      processing_started_at: startedAt,
      processing_completed_at: null,
    })
    .eq("id", submissionId)
    .eq("submission_kind", "practice")
    .in("processing_status", ["pending", "failed"])
    .select("id, student_id, comment, file_names, storage_paths, processing_status, processing_started_at, validation_status, validation_confirmed_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getSubmissionForBackgroundProcessing(submissionId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("work_submissions")
    .select(`
      id,
      student_id,
      comment,
      file_names,
      storage_paths,
      submission_kind,
      reference_payload,
      validation_status,
      validation_confidence,
      validation_reason,
      validation_payload,
      validation_provider,
      validated_at,
      validation_confirmed_at,
      students!inner (
        id,
        first_name,
        current_topic_slug,
        parent_user_id
      )
    `)
    .eq("id", submissionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const student = Array.isArray(data.students) ? data.students[0] : data.students;
  if (!student) return null;
  return {
    submission: {
      id: String(data.id),
      submission_kind: String(data.submission_kind ?? "practice"),
      comment: data.comment == null ? null : String(data.comment),
      file_names: Array.isArray(data.file_names) ? data.file_names.map((item) => String(item)) : [],
      storage_paths: Array.isArray(data.storage_paths) ? data.storage_paths.map((item) => String(item)) : [],
      reference_payload: data.reference_payload && typeof data.reference_payload === "object" ? data.reference_payload as Record<string, unknown> : {},
      validation_status: data.validation_status == null ? null : String(data.validation_status),
      validation_confidence: data.validation_confidence == null ? null : String(data.validation_confidence),
      validation_reason: data.validation_reason == null ? null : String(data.validation_reason),
      validation_payload: data.validation_payload && typeof data.validation_payload === "object" ? data.validation_payload as Record<string, unknown> : {},
      validation_provider: data.validation_provider == null ? null : String(data.validation_provider),
      validated_at: data.validated_at == null ? null : String(data.validated_at),
      validation_confirmed_at: data.validation_confirmed_at == null ? null : String(data.validation_confirmed_at),
    },
    student: {
      id: String(student.id),
      first_name: String(student.first_name),
      current_topic_slug: String(student.current_topic_slug),
      parent_user_id: String(student.parent_user_id),
    },
  };
}

export async function getOwnedSubmissionById(submissionId: string) {
  const { supabase } = await requireAuthenticatedContext();
  const { data, error } = await supabase
    .from("work_submissions")
    .select("id, student_id, submission_kind, processing_status, processing_error, processing_started_at, processing_completed_at, created_at, validation_status, validation_confidence, validation_reason, validation_payload, validation_provider, validated_at, validation_confirmed_at, reference_payload, program_day_id, program_item_id, annual_week_id, annual_week_item_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  await requireOwnedStudent(String(data.student_id));
  return data;
}

export async function exportLicensesCsv() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("license_keys").select("key_suffix, status, product, created_at, activated_at").order("created_at", { ascending: false });
  if (error) throw error;
  const rows = [["suffix", "status", "product", "created_at", "activated_at"]].concat(
    (data ?? []).map((item) => [item.key_suffix, item.status, item.product, item.created_at ?? "", item.activated_at ?? ""])
  );
  return rows.map((row) => row.join(",")).join("\n");
}

export async function getLicenseById(licenseId: string | null) {
  if (!licenseId) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("license_keys").select("id, key_suffix, status, product").eq("id", licenseId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAdminDashboard() {
  const supabase = createAdminClient();
  const [users, licenses, students, activations, submissions, analyses] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("license_keys").select("id", { count: "exact", head: true }),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("license_activations").select("id", { count: "exact", head: true }),
    supabase.from("work_submissions").select("id", { count: "exact", head: true }),
    supabase.from("ai_analyses").select("id", { count: "exact", head: true }),
  ]);
  const { data: latestLicenses } = await supabase.from("license_keys").select("id, key_suffix, product, status").order("created_at", { ascending: false }).limit(8);
  return {
    counts: {
      users: users.count ?? 0,
      licenses: licenses.count ?? 0,
      students: students.count ?? 0,
      activations: activations.count ?? 0,
      submissions: submissions.count ?? 0,
      analyses: analyses.count ?? 0,
    },
    latestLicenses: latestLicenses ?? [],
  };
}

export function getConfiguredAIProvider() {
  return getAIProvider();
}
