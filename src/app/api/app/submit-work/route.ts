import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSubmission, getExercisesByTopic, requireOwnedStudent } from "@/lib/app-data";
import { processDiagnosticSubmission } from "@/lib/diagnostic-processing";
import { processPracticeSubmission } from "@/lib/practice-processing";
import { buildExpectedSubmissionContext } from "@/lib/submission-context";
import { uploadSubmissionFiles, validateSubmissionFiles } from "@/lib/storage";

export async function POST(request: Request) {
  const isAjaxRequest = request.headers.get("x-elan-ajax") === "1";

  const errorResponse = (path: string, errorKey: string, status: number) => {
    if (isAjaxRequest) {
      return NextResponse.json({
        ok: false,
        error:
          errorKey === "files"
            ? "Veuillez choisir un fichier plus petit : 4 MB maximum."
            : errorKey === "forbidden"
              ? "Vous ne pouvez pas envoyer ce diagnostic depuis ce compte."
              : "L’envoi n’a pas pu être terminé. Réessayez.",
        redirectTo: path,
      }, { status });
    }

    return NextResponse.redirect(new URL(`${path}?error=${errorKey}`, request.url), 303);
  };

  const successResponse = (path: string) => {
    if (isAjaxRequest) {
      return NextResponse.json({ ok: true, redirectTo: path });
    }

    return NextResponse.redirect(new URL(path, request.url), 303);
  };

  try {
    const formData = await request.formData();
    const studentId = String(formData.get("studentId") ?? "");
    const submissionKind = String(formData.get("submissionKind") ?? "practice") === "diagnostic" ? "diagnostic" : "practice";
    const pagePath = `/app/${submissionKind === "diagnostic" ? "diagnostic" : "envoyer-travail"}`;

    let student;
    try {
      ({ student } = await requireOwnedStudent(studentId));
    } catch (error) {
      const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 500;
      if (status === 401) {
        if (isAjaxRequest) {
          return NextResponse.json({ ok: false, redirectTo: `/connexion?next=${pagePath}`, error: "Session expirée. Reconnectez-vous pour continuer." }, { status: 401 });
        }
        return NextResponse.redirect(new URL(`/connexion?next=${pagePath}`, request.url), 303);
      }
      if (status === 400 || status === 403) {
        return errorResponse(pagePath, "forbidden", status);
      }
      throw error;
    }

    const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    try {
      validateSubmissionFiles(files);
    } catch (error) {
      const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 400;
      return errorResponse(pagePath, status === 400 ? "files" : "upload", status);
    }

    const submissionId = randomUUID();
    const comment = String(formData.get("comment") ?? "");
    const expectedContext = await buildExpectedSubmissionContext({
      student: {
        id: String(student.id),
        current_topic_slug: String(student.current_topic_slug),
      },
      submissionKind,
    });
    const storedPaths = await uploadSubmissionFiles({
      parentUserId: student.parent_user_id,
      studentId: student.id,
      submissionId,
      files,
    });
    const primaryTopicSlug = expectedContext.expected_topic_slugs[0] ?? student.current_topic_slug;
    const exercise = primaryTopicSlug ? (await getExercisesByTopic(primaryTopicSlug))[0] : null;
    const submission = await createSubmission({
      id: submissionId,
      studentId: student.id,
      exerciseId: submissionKind === "diagnostic" ? null : exercise?.id ?? null,
      programDayId: expectedContext.program_day_id,
      programItemId: expectedContext.program_item_id,
      annualWeekId: expectedContext.annual_week_id,
      annualWeekItemId: expectedContext.annual_week_item_id,
      submissionKind,
      referencePayload: {
        source: expectedContext.context_type,
        referential_version: "2026-08-20",
        server_expected_context: expectedContext,
      },
      validationPayload: {
        state: "pending_validation",
      },
      comment,
      fileNames: files.map((file) => file.name),
      storedPaths,
      processingStatus: "pending",
      processingStartedAt: null,
    });

    if (submissionKind === "diagnostic") {
      after(async () => {
        await processDiagnosticSubmission(submission.id);
      });
      return successResponse(`/app/diagnostic/analyse?submission=${submission.id}`);
    }

    after(async () => {
      await processPracticeSubmission(submission.id);
    });
    return successResponse(`/app/travaux/analyse?submission=${submission.id}`);
  } catch (error) {
    console.error("[submit-work] Unhandled error", error);
    if (isAjaxRequest) {
      return NextResponse.json({
        ok: false,
        error: "L’envoi a échoué après traitement. Vérifiez les logs du diagnostic puis réessayez.",
      }, { status: 500 });
    }
    throw error;
  }
}
