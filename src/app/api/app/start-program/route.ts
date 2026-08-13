import { NextResponse } from "next/server";
import { startPretProgram } from "@/lib/pret-program";

export async function POST(request: Request) {
  const formData = await request.formData();
  const studentId = String(formData.get("studentId") ?? "");

  try {
    await startPretProgram(studentId);
    return NextResponse.redirect(new URL("/app?program=started", request.url));
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 500;
    if (status === 401) {
      return NextResponse.redirect(new URL("/connexion?next=/app", request.url));
    }
    if (status === 400 || status === 403) {
      return NextResponse.redirect(new URL("/app?error=forbidden", request.url));
    }
    if (status === 503) {
      return NextResponse.redirect(new URL("/app?error=program-unavailable", request.url));
    }
    throw error;
  }
}
