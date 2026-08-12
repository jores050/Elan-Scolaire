import { NextResponse } from "next/server";
import { updateStudentSettings } from "@/lib/app-data";

export async function POST(request: Request) {
  const formData = await request.formData();
  const days = String(formData.get("studyDays") ?? "1,2,4,6")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
  await updateStudentSettings(String(formData.get("studentId") ?? ""), Number(formData.get("targetMinutes") ?? 35), days);
  return NextResponse.redirect(new URL("/app/parametres?saved=1", request.url));
}
