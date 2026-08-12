import { NextResponse } from "next/server";
import { createStudyPlan } from "@/lib/app-data";
import { topicLabels } from "@/lib/topics";

export async function POST(request: Request) {
  const formData = await request.formData();
  const studentId = String(formData.get("studentId") ?? "");
  const examDate = String(formData.get("examDate") ?? "");
  const topicSlug = String(formData.get("topicSlug") ?? "thales");
  const duration = String(formData.get("duration") ?? "30 min");
  const topicLabel = topicLabels[topicSlug] ?? "Révision ciblée";
  const items = [
    { dayLabel: "J-4", topic: topicLabel, exercises: `${duration} : revoir la méthode et 2 exercices d'application` },
    { dayLabel: "J-3", topic: topicLabel, exercises: `${duration} : 3 exercices guidés puis auto-correction` },
    { dayLabel: "J-2", topic: topicLabel, exercises: `${duration} : 1 mini série chronométrée` },
    { dayLabel: "J-1", topic: topicLabel, exercises: `${duration} : rappel des erreurs fréquentes et formule-clé` },
    { dayLabel: "Jour J", topic: topicLabel, exercises: "Relecture courte, respiration, confiance" },
  ];

  try {
    await createStudyPlan(studentId, examDate, items);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 500;
    if (status === 401) {
      return NextResponse.redirect(new URL("/connexion?next=/app/preparer-un-devoir", request.url));
    }
    if (status === 400 || status === 403) {
      return NextResponse.redirect(new URL("/app/preparer-un-devoir?error=forbidden", request.url));
    }
    throw error;
  }

  return NextResponse.redirect(new URL("/app/preparer-un-devoir?created=1", request.url));
}
