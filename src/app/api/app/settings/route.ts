import { NextResponse } from "next/server";
import { updateStudentSettings } from "@/lib/app-data";

export async function POST(request: Request) {
  const formData = await request.formData();
  const days = String(formData.get("studyDays") ?? "1,2,4,6")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
  try {
    await updateStudentSettings(String(formData.get("studentId") ?? ""), Number(formData.get("targetMinutes") ?? 35), days);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 500;
    if (status === 401) {
      return NextResponse.redirect(new URL("/connexion?next=/app/parametres", request.url));
    }
    if (status === 400 || status === 403) {
      return NextResponse.redirect(new URL("/app/parametres?error=forbidden", request.url));
    }
    throw error;
  }
  return NextResponse.redirect(new URL("/app/parametres?saved=1", request.url));
}
