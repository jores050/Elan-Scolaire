import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getAIProvider } from "@/lib/env";
import { topicLabels } from "@/lib/topics";

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

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

export async function requireOwnedStudent(studentId: string) {
  const normalizedStudentId = studentId.trim();
  if (!normalizedStudentId) throw createHttpError(400, "Student ID is required.");
  const { user } = await requireAuthenticatedContext();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", normalizedStudentId)
    .eq("parent_user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw createHttpError(403, "Forbidden");
  return { user, student: data };
}

export async function listStudentsForParent(parentUserId: string) {
  const { user } = await requireAuthenticatedContext();
  if (user.id !== parentUserId) throw createHttpError(403, "Forbidden");
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("students").select("*").eq("parent_user_id", parentUserId).order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function listNotifications(userId: string) {
  const { user } = await requireAuthenticatedContext();
  if (user.id !== userId) throw createHttpError(403, "Forbidden");
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(6);
  if (error) throw error;
  return data ?? [];
}

export async function getStudent(studentId: string) {
  const { student } = await requireOwnedStudent(studentId);
  return student;
}

export async function setStudentCurrentTopic(studentId: string, areaSlug: string, topicSlug: string) {
  await requireOwnedStudent(studentId);
  const supabase = createAdminClient();
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
  await requireOwnedStudent(studentId);
  const supabase = createAdminClient();
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
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("exercises").select("*").eq("topic_id", topic.id).order("estimated_minutes");
  if (error) throw error;
  return data ?? [];
}

export async function getProgressForStudent(studentId: string) {
  await requireOwnedStudent(studentId);
  const supabase = createAdminClient();
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

export async function upsertTopicProgress(studentId: string, topicSlug: string, score: number) {
  const topic = await findTopicBySlug(topicSlug);
  if (!topic) return;
  const supabase = createAdminClient();
  const mastery = score >= 75 ? "maitrise" : score >= 50 ? "en_cours" : "a_renforcer";
  const { error } = await supabase.from("student_topic_progress").upsert(
    {
      id: randomUUID(),
      student_id: studentId,
      topic_id: topic.id,
      score,
      mastery,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,topic_id" }
  );
  if (error) throw error;
}

export async function getLatestAnalysisForStudent(studentId: string) {
  await requireOwnedStudent(studentId);
  const supabase = createAdminClient();
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
  await requireOwnedStudent(studentId);
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("work_submissions").select("*").eq("student_id", studentId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listSubmissionsWithAnalyses(studentId: string) {
  await requireOwnedStudent(studentId);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("work_submissions")
    .select("*, ai_analyses(*)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createSubmission(input: { studentId: string; exerciseId: string | null; comment: string; fileNames: string[]; storedPaths: string[] }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("work_submissions")
    .insert({
      id: randomUUID(),
      student_id: input.studentId,
      exercise_id: input.exerciseId,
      comment: input.comment,
      file_names: input.fileNames,
      storage_paths: input.storedPaths,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createAnalysis(input: {
  submissionId: string;
  score: number;
  status: string;
  pointsForts: string[];
  erreurs: string[];
  notionsARevoir: string[];
  conseilEleve: string;
  conseilParent: string;
  exercicesRecommandes: string[];
  provider: string;
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
      provider: input.provider,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function addNotification(entry: { userId: string; type: string; message: string }) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("notifications").insert({
    id: randomUUID(),
    user_id: entry.userId,
    type: entry.type,
    message: entry.message,
    created_at: new Date().toISOString(),
    read: false,
  });
  if (error) throw error;
}

export async function createStudyPlan(studentId: string, examDate: string, items: Array<{ dayLabel: string; topic: string; exercises: string }>) {
  await requireOwnedStudent(studentId);
  const supabase = createAdminClient();
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
  await requireOwnedStudent(studentId);
  const supabase = createAdminClient();
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
  if (license.status === "activated") return { ok: false as const, reason: "deja_utilisee" };
  return { ok: true as const, license };
}

export async function activateLicense(code: string, userId: string) {
  const supabase = createAdminClient();
  const normalized = code.trim().toUpperCase();
  const { data: license, error } = await supabase.from("license_keys").select("*").eq("key_hash", hashText(normalized)).maybeSingle();
  if (error) throw error;
  if (!license || license.status !== "available") throw new Error("Cette clÃ© ne peut pas Ãªtre activÃ©e.");
  const now = new Date().toISOString();
  await supabase.from("license_keys").update({ status: "activated", activated_at: now, activated_by: userId }).eq("id", license.id);
  await supabase.from("license_activations").insert({ id: randomUUID(), license_id: license.id, user_id: userId, activated_at: now, visible_suffix: license.key_suffix });
  await supabase.from("profiles").upsert({ id: userId, active_license_id: license.id, created_at: now }, { onConflict: "id" });
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

export async function createProfile(input: { id: string; email: string; fullName: string; role?: string }) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").upsert({
    id: input.id,
    email: input.email,
    full_name: input.fullName,
    role: input.role ?? "parent",
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function createLicenseBatch(count: number, actorUserId?: string) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const generated = Array.from({ length: count }).map(() => {
    const plainText = generateLicensePlainText();
    return {
      id: randomUUID(),
      key_hash: hashText(plainText),
      key_prefix: "ELAN-3E",
      key_suffix: plainText.slice(-4),
      product: "PRÃŠT POUR LA 3e â€” MATHS BÃ‰NIN",
      status: "available",
      max_students: 2,
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
    created_at: item.created_at,
  })));
  if (error) throw error;
  if (actorUserId) {
    await supabase.from("admin_audit_logs").insert({
      id: randomUUID(),
      actor_user_id: actorUserId,
      action: "generate_licenses",
      payload: { quantity: count },
      created_at: now,
    });
  }
  return generated;
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
