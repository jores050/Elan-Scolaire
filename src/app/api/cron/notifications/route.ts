import { NextResponse } from "next/server";
import {
  addNotificationIfAbsent,
  listLicensesExpiringSoonForCron,
  listReminderPreferencesForCron,
  listUpcomingExamPlansForCron,
} from "@/lib/app-data";
import {
  getLicenseReminderMilestone,
  getLocalDateKey,
  getLocalWeekKey,
  getReminderTimezone,
  isReminderDue,
} from "@/lib/reminders";
import { getWeeklySummaryForStudent } from "@/lib/weekly-summary";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const nowParam = new URL(request.url).searchParams.get("now");
  const now = nowParam ? new Date(nowParam) : new Date();
  if (!Number.isFinite(now.getTime())) {
    return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
  }

  let created = 0;
  const dateKey = getLocalDateKey(now);
  const weekKey = getLocalWeekKey(now);

  const reminderRows = await listReminderPreferencesForCron();
  for (const row of reminderRows) {
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    if (!student?.parent_user_id || !student?.id || !row.hour) continue;
    if (!isReminderDue({ days: Array.isArray(row.days) ? row.days.map(Number) : [], hour: String(row.hour), now })) continue;
    const inserted = await addNotificationIfAbsent({
      userId: String(student.parent_user_id),
      studentId: String(student.id),
      type: "rappel_etude",
      message: `Rappel d’étude : une séance ÉLAN est prévue aujourd’hui pour ${student.first_name}.`,
      dedupeKey: `rappel-etude:${student.id}:${dateKey}:${row.hour}`,
      metadata: {
        source: "vercel_cron",
        timezone: getReminderTimezone(),
      },
    });
    if (inserted) created += 1;
  }

  const weeklySummaryHour = isReminderDue({ days: [0], hour: "18:00", now, windowMinutes: 10 });
  if (weeklySummaryHour) {
    for (const row of reminderRows) {
      const student = Array.isArray(row.students) ? row.students[0] : row.students;
      if (!student?.parent_user_id || !student?.id) continue;
      const summary = await getWeeklySummaryForStudent(String(student.id));
      if (summary.sessionsPlanned === 0 && summary.scannedWorks === 0) continue;
      const inserted = await addNotificationIfAbsent({
        userId: String(student.parent_user_id),
        studentId: String(student.id),
        type: "bilan_hebdomadaire",
        message: `Bilan hebdomadaire disponible pour ${student.first_name} : ${summary.sessionsCompleted}/${summary.sessionsPlanned} séance(s) réalisées, priorité ${summary.nextPriority}.`,
        dedupeKey: `bilan-hebdo:${student.id}:${weekKey}`,
        metadata: {
          source: "vercel_cron",
          sessions_planned: summary.sessionsPlanned,
          sessions_completed: summary.sessionsCompleted,
          scanned_works: summary.scannedWorks,
          revisit_count: summary.revisitCount,
          reinforce_count: summary.reinforceCount,
          mastered_count: summary.masteredCount,
          next_priority: summary.nextPriority,
        },
      });
      if (inserted) created += 1;
    }
  }

  const examPlans = await listUpcomingExamPlansForCron();
  for (const plan of examPlans) {
    const student = Array.isArray(plan.students) ? plan.students[0] : plan.students;
    if (!student?.parent_user_id || !student?.id) continue;
    const inserted = await addNotificationIfAbsent({
      userId: String(student.parent_user_id),
      studentId: String(student.id),
      type: "devoir_proche",
      message: `${student.first_name} a un devoir ou examen bientôt. Le plan temporaire est prioritaire jusqu’au ${plan.exam_date}.`,
      dedupeKey: `devoir-proche:${plan.id}:${dateKey}`,
      metadata: {
        source: "vercel_cron",
        exam_date: plan.exam_date,
      },
    });
    if (inserted) created += 1;
  }

  const expiringLicenses = await listLicensesExpiringSoonForCron();
  for (const entry of expiringLicenses) {
    const milestone = getLicenseReminderMilestone(entry.daysRemaining);
    if (!milestone) continue;
    const inserted = await addNotificationIfAbsent({
      userId: entry.profileId,
      type: "licence_bientot_expiree",
      message: `Votre licence ÉLAN expire dans ${milestone} jour${milestone > 1 ? "s" : ""}. Vos données sont conservées, mais il faudra la renouveler pour continuer les fonctionnalités premium.`,
      dedupeKey: `licence-expire:${entry.profileId}:${milestone}`,
      metadata: {
        source: "vercel_cron",
        days_remaining: milestone,
      },
    });
    if (inserted) created += 1;
  }

  return NextResponse.json({
    ok: true,
    created,
    timezone: getReminderTimezone(),
    ranAt: now.toISOString(),
  });
}
