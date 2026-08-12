import { NextResponse } from "next/server";
import { setStudentCurrentTopic } from "@/lib/app-data";

export async function POST(request: Request) {
  const formData = await request.formData();
  await setStudentCurrentTopic(
    String(formData.get("studentId") ?? ""),
    String(formData.get("areaSlug") ?? "sa1"),
    String(formData.get("topicSlug") ?? "thales")
  );
  return NextResponse.redirect(new URL("/app?updated=topic", request.url));
}
