import { createAdminClient } from "@/lib/supabase/admin";
import { topicLabels } from "@/lib/topics";

type MasteryValue = "maitrise" | "a_renforcer" | "a_reprendre";

function startOfWeekIso(now = new Date()) {
  const date = new Date(now);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

export type WeeklySummary = {
  sessionsPlanned: number;
  sessionsCompleted: number;
  scannedWorks: number;
  masteredCount: number;
  reinforceCount: number;
  revisitCount: number;
  nextPriority: string;
  summaryText: string;
};

function buildSummaryText(summary: Omit<WeeklySummary, "summaryText">) {
  if (summary.sessionsPlanned === 0) {
    return "Aucune séance n’est encore planifiée cette semaine. ÉLAN proposera la prochaine étape dès qu’un contenu sera disponible.";
  }
  if (summary.revisitCount > 0) {
    return `${summary.sessionsCompleted} séance(s) réalisée(s) sur ${summary.sessionsPlanned}. La priorité de la semaine suivante reste ${summary.nextPriority}.`;
  }
  if (summary.reinforceCount > 0) {
    return `${summary.sessionsCompleted} séance(s) réalisée(s) sur ${summary.sessionsPlanned}. La consolidation continue surtout sur ${summary.nextPriority}.`;
  }
  return `${summary.sessionsCompleted} séance(s) réalisée(s) sur ${summary.sessionsPlanned}. Aucun signal d’alerte majeur cette semaine.`;
}

export async function getWeeklySummaryForStudent(studentId: string): Promise<WeeklySummary> {
  const supabase = createAdminClient();
  const weekStart = startOfWeekIso();

  const [studentQuery, progressQuery, enrollmentQuery, submissionsQuery] = await Promise.all([
    supabase.from("students").select("current_topic_slug").eq("id", studentId).maybeSingle(),
    supabase.from("student_topic_progress").select("mastery, topics!inner(slug, name)").eq("student_id", studentId),
    supabase.from("student_annual_enrollments").select("id").eq("student_id", studentId).eq("status", "active").maybeSingle(),
    supabase.from("work_submissions").select("id").eq("student_id", studentId).gte("created_at", weekStart),
  ]);
  if (studentQuery.error) throw studentQuery.error;
  if (progressQuery.error) throw progressQuery.error;
  if (enrollmentQuery.error) throw enrollmentQuery.error;
  if (submissionsQuery.error) throw submissionsQuery.error;

  let sessionsPlanned = 0;
  let sessionsCompleted = 0;

  if (enrollmentQuery.data?.id) {
    const [weekProgressQuery, itemProgressQuery] = await Promise.all([
      supabase
        .from("student_week_progress")
        .select("week_id")
        .eq("enrollment_id", enrollmentQuery.data.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("student_week_item_progress")
        .select("status, annual_week_items!inner(week_id)")
        .eq("enrollment_id", enrollmentQuery.data.id),
    ]);
    if (weekProgressQuery.error) throw weekProgressQuery.error;
    if (itemProgressQuery.error) throw itemProgressQuery.error;

    const currentWeekId = (weekProgressQuery.data ?? []).at(-1)?.week_id ?? null;
    const currentWeekItems = (itemProgressQuery.data ?? []).filter((row) => {
      const item = Array.isArray(row.annual_week_items) ? row.annual_week_items[0] : row.annual_week_items;
      return currentWeekId != null && String(item?.week_id ?? "") === String(currentWeekId);
    });
    sessionsPlanned = currentWeekItems.length;
    sessionsCompleted = currentWeekItems.filter((row) => row.status === "completed").length;
  }

  const progressRows = (progressQuery.data ?? []).map((row) => {
    const topic = Array.isArray(row.topics) ? row.topics[0] : row.topics;
    return {
      mastery: row.mastery as MasteryValue,
      slug: String(topic?.slug ?? ""),
      name: String(topic?.name ?? "Notion"),
    };
  });

  const masteredCount = progressRows.filter((row) => row.mastery === "maitrise").length;
  const reinforceCount = progressRows.filter((row) => row.mastery === "a_renforcer").length;
  const revisitCount = progressRows.filter((row) => row.mastery === "a_reprendre").length;
  const nextPriorityRow = progressRows.find((row) => row.mastery === "a_reprendre")
    ?? progressRows.find((row) => row.mastery === "a_renforcer")
    ?? progressRows.find((row) => row.slug === String(studentQuery.data?.current_topic_slug ?? ""))
    ?? null;
  const nextPriority = nextPriorityRow ? (topicLabels[nextPriorityRow.slug] ?? nextPriorityRow.name) : "Aucune priorité urgente";

  const summary = {
    sessionsPlanned,
    sessionsCompleted,
    scannedWorks: (submissionsQuery.data ?? []).length,
    masteredCount,
    reinforceCount,
    revisitCount,
    nextPriority,
  };

  return {
    ...summary,
    summaryText: buildSummaryText(summary),
  };
}
