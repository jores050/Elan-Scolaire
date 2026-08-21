import { NextResponse } from "next/server";
import { createStudyPlan, getExercisesByTopic, requireOwnedStudent } from "@/lib/app-data";
import { topicLabels } from "@/lib/topics";

export async function POST(request: Request) {
  const formData = await request.formData();
  const studentId = String(formData.get("studentId") ?? "");
  const examDate = String(formData.get("examDate") ?? "");
  const topicSlug = String(formData.get("topicSlug") ?? "");
  const duration = String(formData.get("duration") ?? "30 min");

  try {
    await requireOwnedStudent(studentId);
    const exercises = await getExercisesByTopic(topicSlug);
    if (exercises.length === 0) return NextResponse.redirect(new URL("/app/preparer-un-devoir?error=no-content", request.url));
    const labels = ["Aujourd’hui", "Consolidation", "Veille du devoir"];
    const items = exercises.slice(0, 3).map((exercise, index) => ({
      dayLabel: labels[index],
      topic: topicLabels[topicSlug] ?? exercise.section,
      exercises: `${duration} · ${exercise.document} · ${exercise.section} · exercices ${exercise.exercise_number}`,
    }));
    await createStudyPlan(studentId, examDate, items);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 500;
    if (status === 401) return NextResponse.redirect(new URL("/connexion?next=/app/preparer-un-devoir", request.url));
    if (status === 400 || status === 403) return NextResponse.redirect(new URL("/app/preparer-un-devoir?error=forbidden", request.url));
    throw error;
  }
  return NextResponse.redirect(new URL("/app/preparer-un-devoir?created=1", request.url));
}
