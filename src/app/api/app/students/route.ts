import { NextResponse } from "next/server";
import { createStudent } from "@/lib/app-data";
import { requireParentAccess } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await requireParentAccess();
    const formData = await request.formData();
    await createStudent({
      parentUserId: user.id,
      firstName: String(formData.get("studentName") ?? ""),
      level: String(formData.get("level") ?? "3e"),
      school: String(formData.get("school") ?? ""),
      currentAreaSlug: String(formData.get("currentAreaSlug") ?? "sa1"),
      currentTopicSlug: "thales",
      objective: String(formData.get("objective") ?? "reprendre_les_bases"),
      targetMinutes: 35,
      studyDays: [1, 2, 4, 6],
    });
    return NextResponse.redirect(new URL("/app", request.url));
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 500;
    if (status === 401) return NextResponse.redirect(new URL("/connexion?next=/app/ajouter-eleve", request.url), 303);
    if (status === 403) return NextResponse.redirect(new URL("/activation?status=expiree", request.url), 303);
    if (status === 409) return NextResponse.redirect(new URL("/app/ajouter-eleve?error=limit", request.url), 303);
    throw error;
  }
}
