import { NextResponse } from "next/server";
import { setStudentCurrentTopic } from "@/lib/app-data";

export async function POST(request: Request) {
  const formData = await request.formData();
  try {
    await setStudentCurrentTopic(
      String(formData.get("studentId") ?? ""),
      String(formData.get("areaSlug") ?? "sa1"),
      String(formData.get("topicSlug") ?? "thales")
    );
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 500;
    if (status === 401) {
      return NextResponse.redirect(new URL("/connexion?next=/app", request.url));
    }
    if (status === 400 || status === 403) {
      return NextResponse.redirect(new URL("/app?error=forbidden", request.url));
    }
    throw error;
  }
  return NextResponse.redirect(new URL("/app?updated=topic", request.url));
}
