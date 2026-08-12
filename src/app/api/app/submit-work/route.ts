import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { analyzeSubmission } from "@/lib/analysis";
import { createSubmission, getExercisesByTopic, requireOwnedStudent } from "@/lib/app-data";

export async function POST(request: Request) {
  const formData = await request.formData();
  const studentId = String(formData.get("studentId") ?? "");

  let student;
  try {
    ({ student } = await requireOwnedStudent(studentId));
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 500;
    if (status === 401) {
      return NextResponse.redirect(new URL("/connexion?next=/app/envoyer-travail", request.url));
    }
    if (status === 400 || status === 403) {
      return NextResponse.redirect(new URL("/app/envoyer-travail?error=forbidden", request.url));
    }
    throw error;
  }

  const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length === 0) {
    return NextResponse.redirect(new URL("/app/envoyer-travail?error=files", request.url));
  }

  const savedPaths: string[] = [];
  const fileNames: string[] = [];
  const folder = path.join(/* turbopackIgnore: true */ process.cwd(), "data", "uploads", student.id);
  mkdirSync(folder, { recursive: true });

  for (const file of files.slice(0, 4)) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const dest = path.join(folder, safeName);
    writeFileSync(dest, bytes);
    savedPaths.push(dest);
    fileNames.push(file.name);
  }

  const exercise = (await getExercisesByTopic(student.current_topic_slug))[0];
  const submission = await createSubmission({
    studentId: student.id,
    exerciseId: exercise?.id ?? null,
    comment: String(formData.get("comment") ?? ""),
    fileNames,
    storedPaths: savedPaths,
  });

  await analyzeSubmission(student, submission);
  return NextResponse.redirect(new URL("/app/travaux?uploaded=1", request.url));
}
