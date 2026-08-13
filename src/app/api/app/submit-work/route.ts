import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { analyzeSubmission } from "@/lib/analysis";
import { createSubmission, getExercisesByTopic, requireOwnedStudent } from "@/lib/app-data";
import { updatePretProgramProgressAfterAnalysis } from "@/lib/pret-program";
import { uploadSubmissionFiles, validateSubmissionFiles } from "@/lib/storage";

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
  try {
    validateSubmissionFiles(files);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 400;
    return NextResponse.redirect(new URL(`/app/envoyer-travail?error=${status === 400 ? "files" : "upload"}`, request.url));
  }

  const submissionId = randomUUID();
  const storedPaths = await uploadSubmissionFiles({
    parentUserId: student.parent_user_id,
    studentId: student.id,
    submissionId,
    files,
  });

  const exercise = (await getExercisesByTopic(student.current_topic_slug))[0];
  const submission = await createSubmission({
    id: submissionId,
    studentId: student.id,
    exerciseId: exercise?.id ?? null,
    programDayId: String(formData.get("programDayId") ?? "") || null,
    programItemId: String(formData.get("programItemId") ?? "") || null,
    comment: String(formData.get("comment") ?? ""),
    fileNames: files.map((file) => file.name),
    storedPaths,
  });

  const analysis = await analyzeSubmission(student, submission);
  await updatePretProgramProgressAfterAnalysis({
    submissionId: submission.id,
    studentId: student.id,
    programDayId: submission.program_day_id ?? null,
    programItemId: submission.program_item_id ?? null,
    score: analysis.score,
    status: analysis.status,
  });
  return NextResponse.redirect(new URL("/app/travaux?uploaded=1", request.url));
}
