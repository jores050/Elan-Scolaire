import { NextResponse } from "next/server";
import { clearLoginSession } from "@/lib/auth";

export async function POST(request: Request) {
  await clearLoginSession();
  return NextResponse.redirect(new URL("/connexion", request.url));
}
