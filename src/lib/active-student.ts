import { cookies } from "next/headers";
import { resolveActiveStudent } from "@/lib/active-student-core";
import { listStudentsForParent } from "@/lib/app-data";

export const ACTIVE_STUDENT_COOKIE = "elan_active_student";

export const activeStudentCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

export async function getStudentSelectionForParent(parentUserId: string) {
  const [cookieStore, students] = await Promise.all([
    cookies(),
    listStudentsForParent(parentUserId),
  ]);
  const preferredStudentId = cookieStore.get(ACTIVE_STUDENT_COOKIE)?.value ?? null;
  const activeStudent = resolveActiveStudent(students, preferredStudentId);
  return {
    students,
    activeStudent,
  };
}
