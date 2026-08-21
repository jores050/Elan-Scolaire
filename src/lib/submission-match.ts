import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { Buffer } from "node:buffer";
import path from "node:path";
import { z } from "zod";

export type SubmissionMatchStatus = "MATCH" | "PARTIAL_MATCH" | "MISMATCH" | "UNREADABLE";
export type SubmissionMatchConfidence = "high" | "medium" | "low";
export type SubmissionValidationDecision = "allow_analysis" | "needs_confirmation" | "blocked" | "retry";
export type SubmissionContextType = "diagnostic" | "pret_program" | "annual_tracking" | "exam_prep" | "free_practice";

export type ExpectedGuideItem = {
  reference_id: string;
  document_type: "DIAGNOSTIC" | "PROGRAM_DAY" | "FINAL_TEST";
  day_number: number | null;
  section_code: string | null;
  section_label: string | null;
  level_code: string | null;
  level_label: string | null;
  exercise_number: string | null;
  item_type: string;
  prompt_text: string;
  topic_slug: string | null;
  skill_tested: string | null;
  expected_answer: string | null;
  accepted_answers: string[];
  scoring_rules: Record<string, unknown>;
  common_errors: string[];
  correction_ref: string | null;
  answer_status: string | null;
  page_reference: string | null;
};

export type SubmissionValidationFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ExpectedSubmissionContext = {
  submission_kind: "practice" | "diagnostic";
  student_id: string;
  context_type: SubmissionContextType;
  reference_lookup_status?: "ok" | "reference_not_found";
  expected_document_type?: "DIAGNOSTIC" | "PROGRAM_DAY" | "FINAL_TEST" | null;
  guide_code?: string | null;
  expected_topic_slugs: string[];
  guide_reference: string | null;
  page_reference: string | null;
  day_reference?: string | null;
  exercise_references: string[];
  exercise_numbers: string[];
  expected_reference_ids?: string[];
  section_code?: string | null;
  section_label?: string | null;
  level_code?: string | null;
  level_label?: string | null;
  expected_items?: ExpectedGuideItem[];
  title: string | null;
  day_title: string | null;
  day_number: number | null;
  program_day_id: string | null;
  program_item_id: string | null;
  annual_week_id: string | null;
  annual_week_item_id: string | null;
  progression_eligible: boolean;
  pedagogical_prompt: string | null;
};

export type SubmissionValidationOutcome = {
  submissionStatus: SubmissionMatchStatus | null;
  confidence: SubmissionMatchConfidence | null;
  reason: string;
  detectedDocumentType: "DIAGNOSTIC" | "PROGRAM_DAY" | "FINAL_TEST" | "OTHER" | "UNKNOWN" | null;
  detectedDayReference: string | null;
  detectedPageReference: string | null;
  detectedReferenceIds: string[];
  detectedTopicSlugs: string[];
  visibleExerciseNumbers: string[];
  evidence: string[];
  provider: "gemini" | null;
  decision: SubmissionValidationDecision;
  unavailable: boolean;
};

export const submissionMatchSchema = z.object({
  submission_match: z.enum(["MATCH", "PARTIAL_MATCH", "MISMATCH", "UNREADABLE"]),
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string().min(1),
  detected_document_type: z.enum(["DIAGNOSTIC", "PROGRAM_DAY", "FINAL_TEST", "OTHER", "UNKNOWN"]).default("UNKNOWN"),
  detected_day_reference: z.string().nullable().default(""),
  detected_page_reference: z.string().nullable().default(""),
  detected_reference_ids: z.array(z.string()).default([]),
  detected_topic_slugs: z.array(z.string()).default([]),
  visible_exercise_numbers: z.array(z.string()).default([]),
  evidence: z.array(z.string()).max(6).default([]),
});

type GeminiSubmissionMatchPayload = z.infer<typeof submissionMatchSchema>;

const submissionMatchDebugPath = path.join(process.cwd(), "tmp", "submission-match-debug.jsonl");

type SubmissionMatchDebugStage =
  | "VALIDATION_START"
  | "BEFORE_GEMINI_REQUEST"
  | "AFTER_GEMINI_RESPONSE"
  | "AFTER_GEMINI_PARSE"
  | "VALIDATION_MISMATCH_OVERRIDE"
  | "VALIDATION_UNAVAILABLE"
  | "VALIDATION_EXCEPTION";

function sanitizeErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      error_name: typeof error === "object" && error !== null && "name" in error ? String((error as { name?: unknown }).name ?? "") : null,
      error_message: typeof error === "object" && error !== null && "message" in error ? String((error as { message?: unknown }).message ?? "") : String(error),
      error_status: typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: unknown }).status ?? 0) || null : null,
      error_code: typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : null,
    };
  }

  const cause = error.cause && typeof error.cause === "object" ? error.cause as Record<string, unknown> : null;
  const nestedCause = cause?.cause && typeof cause.cause === "object" ? cause.cause as Record<string, unknown> : null;

  return {
    error_name: error.name,
    error_message: error.message,
    error_status: "status" in error ? Number((error as { status?: unknown }).status ?? 0) || null : null,
    error_code: "code" in error ? String((error as { code?: unknown }).code ?? "") : null,
    cause_code: cause && "code" in cause ? String(cause.code ?? "") : null,
    cause_errno: cause && "errno" in cause ? String(cause.errno ?? "") : null,
    cause_syscall: cause && "syscall" in cause ? String(cause.syscall ?? "") : null,
    cause_hostname: cause && "hostname" in cause ? String(cause.hostname ?? "") : null,
    cause_address: cause && "address" in cause ? String(cause.address ?? "") : null,
    cause_port: cause && "port" in cause ? Number(cause.port ?? 0) || null : null,
    nested_cause_code: nestedCause && "code" in nestedCause ? String(nestedCause.code ?? "") : null,
    nested_cause_message: nestedCause && "message" in nestedCause ? String(nestedCause.message ?? "") : null,
  };
}

async function writeSubmissionMatchDebugLog(
  requestId: string,
  stage: SubmissionMatchDebugStage,
  payload: Record<string, unknown>,
) {
  try {
    await mkdir(path.dirname(submissionMatchDebugPath), { recursive: true });
    await appendFile(
      submissionMatchDebugPath,
      `${JSON.stringify({
        requestId,
        stage,
        timestamp: new Date().toISOString(),
        ...payload,
      })}\n`,
      "utf8",
    );
  } catch {
    // Temporary debugging must never block validation flow.
  }
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeDecision(input: GeminiSubmissionMatchPayload): SubmissionValidationOutcome {
  const normalizedStatus: SubmissionMatchStatus = input.submission_match === "MATCH" && input.confidence === "low"
    ? "PARTIAL_MATCH"
    : input.submission_match;

  const decision: SubmissionValidationDecision = normalizedStatus === "MATCH"
    ? "allow_analysis"
    : normalizedStatus === "PARTIAL_MATCH"
      ? "needs_confirmation"
      : "blocked";

  return {
    submissionStatus: normalizedStatus,
    confidence: input.confidence,
    reason: input.reason.trim(),
    detectedDocumentType: input.detected_document_type,
    detectedDayReference: typeof input.detected_day_reference === "string"
      ? input.detected_day_reference.trim() || null
      : null,
    detectedPageReference: typeof input.detected_page_reference === "string"
      ? input.detected_page_reference.trim() || null
      : null,
    detectedReferenceIds: uniqueStrings(input.detected_reference_ids),
    detectedTopicSlugs: uniqueStrings(input.detected_topic_slugs),
    visibleExerciseNumbers: uniqueStrings(input.visible_exercise_numbers),
    evidence: uniqueStrings(input.evidence),
    provider: "gemini",
    decision,
    unavailable: false,
  };
}

function toUnavailable(reason: string): SubmissionValidationOutcome {
  return {
    submissionStatus: null,
    confidence: null,
    reason,
    detectedDocumentType: null,
    detectedDayReference: null,
    detectedPageReference: null,
    detectedReferenceIds: [],
    detectedTopicSlugs: [],
    visibleExerciseNumbers: [],
    evidence: [],
    provider: null,
    decision: "retry",
    unavailable: true,
  };
}

function inferMimeType(file: SubmissionValidationFile) {
  return file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
}

async function buildMultimodalParts(files: SubmissionValidationFile[]) {
  return Promise.all(files.map(async (file) => {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return {
      inlineData: {
        mimeType: inferMimeType(file),
        data: base64,
      },
    };
  }));
}

async function fetchGeminiJson(url: string, payload: unknown, timeoutMs = 180000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildValidationPrompt(context: ExpectedSubmissionContext, fileNames: string[], comment: string | null) {
  return `Tu vérifies seulement si une copie de maths correspond au travail attendu.

Tu ne notes pas la copie.
Tu ne juges pas si la réponse est juste.
Une copie erronée peut être MATCH si elle correspond bien à la bonne notion.

Retourne uniquement un JSON valide conforme au schéma exact :
{
  "submission_match": "MATCH",
  "confidence": "high",
  "reason": "string",
  "detected_document_type": "PROGRAM_DAY",
  "detected_day_reference": "J1",
  "detected_page_reference": "Pages 4-5",
  "detected_reference_ids": ["J1-L1-1", "J1-L1-2"],
  "detected_topic_slugs": ["fractions"],
  "visible_exercise_numbers": ["1", "2"],
  "evidence": ["string"]
}

Règles :
- MATCH si la copie est clairement cohérente avec le travail attendu
- PARTIAL_MATCH si une partie semble cohérente mais la preuve reste incomplète
- MISMATCH si la copie semble clairement porter sur une autre notion
- UNREADABLE si la copie n'est pas assez lisible pour vérifier
- n'exige pas une correspondance textuelle exacte
- accepte les copies avec seulement calculs, numéros d'exercices, méthodes ou brouillon
- accepte plusieurs photos/pages
- base-toi sur la nature des calculs, les structures algébriques/géométriques visibles, les numéros d'exercices s'ils existent et la cohérence globale
- commence par identifier le type de document détecté: DIAGNOSTIC, PROGRAM_DAY, FINAL_TEST, OTHER ou UNKNOWN
- la similarité de notion ne suffit jamais à conclure MATCH
- si le serveur attend un PROGRAM_DAY mais que la copie ressemble au diagnostic, retourne MISMATCH
- si le titre du jour n'est pas visible mais que les exercices visibles correspondent précisément aux références attendues, tu peux conclure MATCH
- utilise seulement des topic_slug parmi ceux attendus ou manifestement visibles

Contexte attendu côté serveur :
${JSON.stringify(context, null, 2)}

Commentaire parent/élève : ${comment ?? "Aucun commentaire"}
Fichiers envoyés : ${fileNames.join(", ") || "Aucun nom de fichier"}`;
}

function simulateValidation(context: ExpectedSubmissionContext, fileNames: string[], comment: string | null): SubmissionValidationOutcome {
  const corpus = `${fileNames.join(" ")} ${comment ?? ""}`.toLowerCase();
  if (corpus.includes("unreadable") || corpus.includes("illisible") || corpus.includes("blurry")) {
    return {
      submissionStatus: "UNREADABLE",
      confidence: "low",
      reason: "La copie de test est explicitement marquée comme illisible.",
      detectedDocumentType: "UNKNOWN",
      detectedDayReference: null,
      detectedPageReference: null,
      detectedReferenceIds: [],
      detectedTopicSlugs: [],
      visibleExerciseNumbers: [],
      evidence: ["copie de test marquée illisible"],
      provider: null,
      decision: "blocked",
      unavailable: false,
    };
  }
  const expectedDocumentType = context.expected_document_type ?? null;
  const expectedReferenceIds = context.expected_reference_ids ?? [];
  const expectedNumbers = context.exercise_numbers;
  if (corpus.includes("diag-") || corpus.includes("diagnostic")) {
    const isExpectedDiagnostic = expectedDocumentType === "DIAGNOSTIC";
    return {
      submissionStatus: isExpectedDiagnostic ? "MATCH" : "MISMATCH",
      confidence: "high",
      reason: isExpectedDiagnostic
        ? "La copie de test se présente explicitement comme le diagnostic attendu."
        : "La copie de test se présente explicitement comme un diagnostic alors qu'un autre document était attendu.",
      detectedDocumentType: "DIAGNOSTIC",
      detectedDayReference: null,
      detectedPageReference: "Pages 2-3",
      detectedReferenceIds: ["DIAG-01", "DIAG-02", "DIAG-03", "DIAG-04", "DIAG-05"],
      detectedTopicSlugs: context.expected_topic_slugs,
      visibleExerciseNumbers: [],
      evidence: ["indicateur DIAG/diagnostic détecté dans les données de test"],
      provider: null,
      decision: isExpectedDiagnostic ? "allow_analysis" : "blocked",
      unavailable: false,
    };
  }
  if (corpus.includes("equation") || corpus.includes("equations")) {
    const mismatch = context.expected_topic_slugs.includes("equations") ? "MATCH" : "MISMATCH";
    return {
      submissionStatus: mismatch,
      confidence: mismatch === "MATCH" ? "medium" : "high",
      reason: mismatch === "MATCH"
        ? "La copie de test mentionne la notion attendue."
        : "La copie de test mentionne des équations alors qu'une autre notion était attendue.",
      detectedDocumentType: expectedDocumentType ?? "OTHER",
      detectedDayReference: context.day_reference ?? null,
      detectedPageReference: context.page_reference ?? null,
      detectedReferenceIds: [],
      detectedTopicSlugs: ["equations"],
      visibleExerciseNumbers: [],
      evidence: ["mot-clé equations détecté dans les données de test"],
      provider: null,
      decision: mismatch === "MATCH" ? "allow_analysis" : "blocked",
      unavailable: false,
    };
  }
  if (corpus.includes("partial") || corpus.includes("partiel")) {
    return {
      submissionStatus: "PARTIAL_MATCH",
      confidence: "medium",
      reason: "La copie de test indique une correspondance partielle.",
      detectedDocumentType: expectedDocumentType ?? "UNKNOWN",
      detectedDayReference: context.day_reference ?? null,
      detectedPageReference: context.page_reference ?? null,
      detectedReferenceIds: expectedReferenceIds.slice(0, Math.max(1, Math.floor(expectedReferenceIds.length / 2))),
      detectedTopicSlugs: context.expected_topic_slugs,
      visibleExerciseNumbers: expectedNumbers.slice(0, Math.max(1, Math.floor(expectedNumbers.length / 2))),
      evidence: ["indicateur de test partial détecté"],
      provider: null,
      decision: "needs_confirmation",
      unavailable: false,
    };
  }
  const exactExerciseHit = expectedNumbers.length > 0 && expectedNumbers.every((value) => corpus.includes(value.toLowerCase()));
  const exactReferenceHit = expectedReferenceIds.length > 0 && expectedReferenceIds.some((value) => corpus.includes(value.toLowerCase()));
  return {
    submissionStatus: exactExerciseHit || exactReferenceHit || expectedDocumentType !== "PROGRAM_DAY" ? "MATCH" : "PARTIAL_MATCH",
    confidence: exactExerciseHit || exactReferenceHit ? "high" : "medium",
    reason: exactExerciseHit || exactReferenceHit
      ? "La copie de test correspond précisément aux exercices attendus."
      : "La copie de test semble cohérente avec le travail attendu, sans preuve complète sur chaque exercice.",
    detectedDocumentType: expectedDocumentType ?? "UNKNOWN",
    detectedDayReference: context.day_reference ?? null,
    detectedPageReference: context.page_reference ?? null,
    detectedReferenceIds: exactReferenceHit ? expectedReferenceIds : [],
    detectedTopicSlugs: context.expected_topic_slugs,
    visibleExerciseNumbers: context.exercise_numbers,
    evidence: [exactExerciseHit || exactReferenceHit ? "simulation de test alignée sur les références attendues" : "simulation de test cohérente avec le contexte attendu"],
    provider: null,
    decision: exactExerciseHit || exactReferenceHit || expectedDocumentType !== "PROGRAM_DAY" ? "allow_analysis" : "needs_confirmation",
    unavailable: false,
  };
}

export function parseExpectedSubmissionContext(referencePayload: unknown): ExpectedSubmissionContext | null {
  if (!referencePayload || typeof referencePayload !== "object" || Array.isArray(referencePayload)) return null;
  const payload = referencePayload as Record<string, unknown>;
  const snapshot = payload.server_expected_context;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const candidate = snapshot as Record<string, unknown>;
  if ((candidate.submission_kind !== "practice" && candidate.submission_kind !== "diagnostic") || typeof candidate.student_id !== "string") {
    return null;
  }
  return {
    submission_kind: candidate.submission_kind,
    student_id: candidate.student_id,
    context_type: typeof candidate.context_type === "string" ? candidate.context_type as SubmissionContextType : "free_practice",
    reference_lookup_status: candidate.reference_lookup_status === "reference_not_found" ? "reference_not_found" : "ok",
    expected_document_type: candidate.expected_document_type === "DIAGNOSTIC" || candidate.expected_document_type === "PROGRAM_DAY" || candidate.expected_document_type === "FINAL_TEST"
      ? candidate.expected_document_type
      : null,
    guide_code: typeof candidate.guide_code === "string" ? candidate.guide_code : null,
    expected_topic_slugs: Array.isArray(candidate.expected_topic_slugs) ? candidate.expected_topic_slugs.map(String) : [],
    guide_reference: typeof candidate.guide_reference === "string" ? candidate.guide_reference : null,
    page_reference: typeof candidate.page_reference === "string" ? candidate.page_reference : null,
    day_reference: typeof candidate.day_reference === "string" ? candidate.day_reference : null,
    exercise_references: Array.isArray(candidate.exercise_references) ? candidate.exercise_references.map(String) : [],
    exercise_numbers: Array.isArray(candidate.exercise_numbers) ? candidate.exercise_numbers.map(String) : [],
    expected_reference_ids: Array.isArray(candidate.expected_reference_ids) ? candidate.expected_reference_ids.map(String) : [],
    section_code: typeof candidate.section_code === "string" ? candidate.section_code : null,
    section_label: typeof candidate.section_label === "string" ? candidate.section_label : null,
    level_code: typeof candidate.level_code === "string" ? candidate.level_code : null,
    level_label: typeof candidate.level_label === "string" ? candidate.level_label : null,
    expected_items: Array.isArray(candidate.expected_items)
      ? candidate.expected_items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
        .map((item) => ({
          reference_id: String(item.reference_id ?? ""),
          document_type: item.document_type === "DIAGNOSTIC" || item.document_type === "PROGRAM_DAY" || item.document_type === "FINAL_TEST" ? item.document_type : "PROGRAM_DAY",
          day_number: typeof item.day_number === "number" ? item.day_number : null,
          section_code: typeof item.section_code === "string" ? item.section_code : null,
          section_label: typeof item.section_label === "string" ? item.section_label : null,
          level_code: typeof item.level_code === "string" ? item.level_code : null,
          level_label: typeof item.level_label === "string" ? item.level_label : null,
          exercise_number: typeof item.exercise_number === "string" ? item.exercise_number : null,
          item_type: String(item.item_type ?? "QUESTION"),
          prompt_text: String(item.prompt_text ?? ""),
          topic_slug: typeof item.topic_slug === "string" ? item.topic_slug : null,
          skill_tested: typeof item.skill_tested === "string" ? item.skill_tested : null,
          expected_answer: typeof item.expected_answer === "string" ? item.expected_answer : null,
          accepted_answers: Array.isArray(item.accepted_answers) ? item.accepted_answers.map(String) : [],
          scoring_rules: item.scoring_rules && typeof item.scoring_rules === "object" && !Array.isArray(item.scoring_rules) ? item.scoring_rules as Record<string, unknown> : {},
          common_errors: Array.isArray(item.common_errors) ? item.common_errors.map(String) : [],
          correction_ref: typeof item.correction_ref === "string" ? item.correction_ref : null,
          answer_status: typeof item.answer_status === "string" ? item.answer_status : null,
          page_reference: typeof item.page_reference === "string" ? item.page_reference : null,
        }))
      : [],
    title: typeof candidate.title === "string" ? candidate.title : null,
    day_title: typeof candidate.day_title === "string" ? candidate.day_title : null,
    day_number: typeof candidate.day_number === "number" ? candidate.day_number : null,
    program_day_id: typeof candidate.program_day_id === "string" ? candidate.program_day_id : null,
    program_item_id: typeof candidate.program_item_id === "string" ? candidate.program_item_id : null,
    annual_week_id: typeof candidate.annual_week_id === "string" ? candidate.annual_week_id : null,
    annual_week_item_id: typeof candidate.annual_week_item_id === "string" ? candidate.annual_week_item_id : null,
    progression_eligible: Boolean(candidate.progression_eligible),
    pedagogical_prompt: typeof candidate.pedagogical_prompt === "string" ? candidate.pedagogical_prompt : null,
  };
}

export async function validateSubmissionMatch(input: {
  expectedContext: ExpectedSubmissionContext;
  files: SubmissionValidationFile[];
  comment: string | null;
  fileNames: string[];
}) {
  const requestId = randomUUID();
  if (process.env.NODE_ENV === "test" || process.env.AI_PROVIDER === "mock") {
    return simulateValidation(input.expectedContext, input.fileNames, input.comment);
  }

  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const endpointWithoutKey = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  await writeSubmissionMatchDebugLog(requestId, "VALIDATION_START", {
    ai_provider: process.env.AI_PROVIDER ?? null,
    gemini_key_configured: Boolean(key),
    gemini_model: model,
    endpoint: endpointWithoutKey,
    expected_document_type: input.expectedContext.expected_document_type ?? null,
    expected_day_reference: input.expectedContext.day_reference ?? null,
    expected_page_reference: input.expectedContext.page_reference ?? null,
    expected_reference_ids_count: input.expectedContext.expected_reference_ids?.length ?? 0,
    expected_items_count: input.expectedContext.expected_items?.length ?? 0,
    file_count: input.files.length,
    file_names: input.fileNames,
    comment_present: Boolean(input.comment?.trim()),
  });

  if (!key) {
    await writeSubmissionMatchDebugLog(requestId, "VALIDATION_UNAVAILABLE", {
      reason: "missing_gemini_api_key",
    });
    return toUnavailable("Nous ne pouvons pas vérifier cette copie pour le moment.");
  }

  const prompt = buildValidationPrompt(input.expectedContext, input.fileNames, input.comment);

  try {
    await writeSubmissionMatchDebugLog(requestId, "BEFORE_GEMINI_REQUEST", {
      endpoint: endpointWithoutKey,
      prompt_length: prompt.length,
      file_count: input.files.length,
    });
    const response = await fetchGeminiJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        contents: [{ parts: [{ text: prompt }, ...(await buildMultimodalParts(input.files))] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      },
    );
    await writeSubmissionMatchDebugLog(requestId, "AFTER_GEMINI_RESPONSE", {
      endpoint: endpointWithoutKey,
      http_status: response.status,
      http_status_text: response.statusText,
      response_ok: response.ok,
    });
    if (!response.ok) {
      let errorBody: unknown = null;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = null;
      }
      await writeSubmissionMatchDebugLog(requestId, "VALIDATION_UNAVAILABLE", {
        reason: "gemini_response_not_ok",
        http_status: response.status,
        http_status_text: response.statusText,
        error_body_excerpt: typeof errorBody === "string" ? errorBody.slice(0, 1000) : null,
      });
      return toUnavailable("Nous ne pouvons pas vérifier cette copie pour le moment.");
    }
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      await writeSubmissionMatchDebugLog(requestId, "VALIDATION_UNAVAILABLE", {
        reason: "gemini_empty_text",
        candidate_count: data.candidates?.length ?? 0,
      });
      return toUnavailable("Nous ne pouvons pas vérifier cette copie pour le moment.");
    }
    const parsed = submissionMatchSchema.parse(JSON.parse(text));
    const normalized = normalizeDecision(parsed);
    await writeSubmissionMatchDebugLog(requestId, "AFTER_GEMINI_PARSE", {
      submission_match: parsed.submission_match,
      confidence: parsed.confidence,
      detected_document_type: parsed.detected_document_type,
      detected_day_reference: parsed.detected_day_reference || null,
      detected_page_reference: parsed.detected_page_reference || null,
      detected_reference_ids_count: parsed.detected_reference_ids.length,
    });
    if (input.expectedContext.expected_document_type
      && normalized.detectedDocumentType
      && normalized.detectedDocumentType !== "UNKNOWN"
      && normalized.detectedDocumentType !== "OTHER"
      && normalized.detectedDocumentType !== input.expectedContext.expected_document_type
      && normalized.submissionStatus !== "UNREADABLE") {
      const forcedMismatch: SubmissionValidationOutcome = {
        ...normalized,
        submissionStatus: "MISMATCH",
        decision: "blocked",
        confidence: "high",
        reason: `Le document détecté (${normalized.detectedDocumentType}) ne correspond pas au document attendu (${input.expectedContext.expected_document_type}).`,
      };
      await writeSubmissionMatchDebugLog(requestId, "VALIDATION_MISMATCH_OVERRIDE", {
        expected_document_type: input.expectedContext.expected_document_type,
        detected_document_type: normalized.detectedDocumentType,
      });
      return forcedMismatch;
    }
    return normalized;
  } catch (error) {
    await writeSubmissionMatchDebugLog(requestId, "VALIDATION_EXCEPTION", {
      endpoint: endpointWithoutKey,
      ...sanitizeErrorDetails(error),
    });
    return toUnavailable("Nous ne pouvons pas vérifier cette copie pour le moment.");
  }
}
