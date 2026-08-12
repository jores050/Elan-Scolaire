import { NextResponse } from "next/server";
import { createStudyPlan } from "@/lib/app-data";
import { topicLabels } from "@/lib/topics";

export async function POST(request: Request) {
  const formData = await request.formData();
  const studentId = String(formData.get("studentId") ?? "");
  const examDate = String(formData.get("examDate") ?? "");
  const topicSlug = String(formData.get("topicSlug") ?? "thales");
  const items = [
    { dayLabel: "J-4", topic: topicLabels[topicSlug] ?? "Révision", exercises: "3 exercices méthode" },
    { dayLabel: "J-3", topic: "Triangle rectangle", exercises: "3 exercices guidés" },
    { dayLabel: "J-2", topic: "Trigonométrie", exercises: "4 exercices de consolidation" },
    { dayLabel: "J-1", topic: "Mini devoir", exercises: "Sujet rapide + rappel des méthodes" },
    { dayLabel: "Jour J", topic: "Rappel", exercises: "Relecture des méthodes clés" },
  ];
  await createStudyPlan(studentId, examDate, items);
  return NextResponse.redirect(new URL("/app/preparer-un-devoir?created=1", request.url));
}
