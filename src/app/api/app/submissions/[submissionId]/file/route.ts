import { NextResponse } from "next/server";
import { listSubmissionsForStudent, requireOwnedStudent } from "@/lib/app-data";
import { createSignedSubmissionUrl, isOwnedStoragePath } from "@/lib/storage";

export async function GET(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const url = new URL(request.url);
  const studentId = String(url.searchParams.get("studentId") ?? "");
  const filePath = String(url.searchParams.get("path") ?? "");
  const { submissionId } = await context.params;

  try {
    const { student } = await requireOwnedStudent(studentId);
    const submissions = await listSubmissionsForStudent(student.id);
    const submission = submissions.find((item) => item.id === submissionId);
    if (!submission) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const paths = Array.isArray(submission.storage_paths) ? submission.storage_paths : [];
    if (!paths.includes(filePath)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (!isOwnedStoragePath(filePath, student.parent_user_id, student.id)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const signedUrl = await createSignedSubmissionUrl(filePath);
    return NextResponse.json({ signedUrl });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 500;
    if (status === 401) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (status === 403) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw error;
  }
}
