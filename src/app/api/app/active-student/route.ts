import { NextResponse } from "next/server";
import { ACTIVE_STUDENT_COOKIE, activeStudentCookieOptions } from "@/lib/active-student";
import { listStudentsForParent } from "@/lib/app-data";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/connexion?next=/app", request.url), 303);
  if (user.role !== "parent") return NextResponse.redirect(new URL("/admin", request.url), 303);

  const formData = await request.formData();
  const studentId = String(formData.get("studentId") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/app") || "/app";
  const students = await listStudentsForParent(user.id);
  const validStudent = students.find((student) => student.id === studentId);
  const response = NextResponse.redirect(new URL(redirectTo.startsWith("/") ? redirectTo : "/app", request.url), 303);

  if (validStudent) {
    response.cookies.set(ACTIVE_STUDENT_COOKIE, validStudent.id, activeStudentCookieOptions);
  }

  return response;
}
