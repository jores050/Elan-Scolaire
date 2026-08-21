import { Buffer } from "node:buffer";
import { z } from "zod";
import { addNotificationIfAbsent, createAnalysis, getTopicProgressSnapshot, upsertTopicProgress } from "@/lib/app-data";
import { diagnosticReferential, diagnosticTopicOrder, getGuideRecommendation, type ControlledDepth, type GuideRecommendation } from "@/lib/diagnostic-referential";
import type { ExpectedGuideItem } from "@/lib/submission-match";
import { evaluateDiagnosticTopicResults } from "@/lib/diagnostic-evaluation";
import { topicLabels } from "@/lib/topics";

export type AnalysisKind = "practice" | "diagnostic";

type LessonAi = {
  title: string;
  duration_minutes: number;
  explanation: string;
  examples: string[];
};

type FollowUpQuestion = {
  topic_slug: string;
  question: string;
};

type SerializedGuideRoute = {
  day_number: number;
  day_title: string;
  guide_title: string;
  page_reference: string;
  primary_part: string;
  primary_level: string;
  mini_test_ref: string;
};

type TopicAnalysisPayload = {
  topic_slug: string;
  topic_label: string;
  mastery: "maitrise" | "a_renforcer" | "a_reprendre";
  depth: ControlledDepth;
  confidence: "high" | "medium" | "low";
  reason: string;
  lesson_ai: LessonAi | null;
  needs_follow_up: boolean;
  follow_up_topics: string[];
  follow_up_questions: FollowUpQuestion[];
  guide_route: SerializedGuideRoute | null;
  score?: number | null;
  evidence_count?: number;
  correct_count?: number;
  partial_count?: number;
  incorrect_count?: number;
  evidence?: string[];
  reference_ids?: string[];
  recommended_day_numbers?: number[];
};

type PracticeAnalysisResult = {
  score: number | null;
  status: "reussi" | "partiel" | "a_revoir";
  pointsForts: string[];
  erreurs: string[];
  notionsARevoir: string[];
  conseilEleve: string;
  conseilParent: string;
  exercicesRecommandes: string[];
  provider: "gemini" | "local";
  analysisKind: "practice";
  topicResults: TopicAnalysisPayload[];
  nextSteps: Array<{
    topic_slug: string;
    topic_label: string;
    mastery: "maitrise" | "a_renforcer" | "a_reprendre";
    depth: ControlledDepth;
    guide_route: SerializedGuideRoute | null;
  }>;
};

type DiagnosticAnalysisResult = {
  score: number | null;
  status: "reussi" | "partiel" | "a_revoir";
  pointsForts: string[];
  erreurs: string[];
  notionsARevoir: string[];
  conseilEleve: string;
  conseilParent: string;
  exercicesRecommandes: string[];
  provider: "gemini" | "local";
  analysisKind: "diagnostic";
  topicResults: TopicAnalysisPayload[];
  nextSteps: Array<{
    topic_slug: string;
    topic_label: string;
    mastery: "maitrise" | "a_renforcer" | "a_reprendre";
    depth: ControlledDepth;
    guide_route: SerializedGuideRoute | null;
  }>;
  summaryAi: string;
};

type AnalysisResult = PracticeAnalysisResult | DiagnosticAnalysisResult;

type StudentForAnalysis = {
  id: string;
  first_name: string;
  current_topic_slug: string;
  parent_user_id: string;
};

type SubmissionForAnalysis = {
  id: string;
  comment: string | null;
  file_names: string[] | null;
};

type PedagogicalContext = {
  itemType: string;
  title: string | null;
  prompt: string;
  guideReference: string;
  correctionReference: string | null;
  difficultyLabel: string | null;
  metadata: unknown;
  dayNumber: number | null;
  dayTitle: string | null;
  dayObjective: string | null;
} | null;

type AnalysisFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type ExpectedGuideContextSnapshot = {
  expected_document_type: "DIAGNOSTIC" | "PROGRAM_DAY" | "FINAL_TEST" | null;
  day_reference: string | null;
  section_code: string | null;
  section_label: string | null;
  level_code: string | null;
  level_label: string | null;
  expected_reference_ids: string[];
  expected_items: ExpectedGuideItem[];
  reference_lookup_status: "ok" | "reference_not_found";
};

type AnalyzeSubmissionOptions = {
  analysisKind?: AnalysisKind;
  pedagogicalContext?: PedagogicalContext;
  persistProgress?: boolean;
};

const lessonAiSchema = z.object({
  title: z.string(),
  duration_minutes: z.number().int().min(1).max(5),
  explanation: z.string(),
  examples: z.array(z.string()).max(2),
});

const followUpQuestionSchema = z.object({
  topic_slug: z.string(),
  question: z.string(),
});

const topicAssessmentSchema = z.object({
  topic_slug: z.string(),
  depth: z.enum(["FOUNDATIONS", "CONSOLIDATION", "VALIDATION"]),
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string(),
  lesson_ai: lessonAiSchema,
  needs_follow_up: z.boolean(),
  follow_up_topics: z.array(z.string()),
  follow_up_questions: z.array(followUpQuestionSchema).max(4).optional().default([]),
});

const geminiPracticeSchema = z.object({
  score: z.number().min(0).max(20).nullable(),
  status: z.enum(["reussi", "partiel", "a_revoir"]),
  points_forts: z.array(z.string()),
  erreurs: z.array(z.string()),
  notions_a_revoir: z.array(z.string()),
  conseil_eleve: z.string(),
  conseil_parent: z.string(),
  exercices_recommandes: z.array(z.string()),
  score_fiable: z.boolean().optional(),
  topic_assessments: z.array(topicAssessmentSchema).max(3).default([]),
});

const geminiDiagnosticSchema = z.object({
  points_forts: z.array(z.string()),
  vigilance: z.array(z.string()),
  conseil_eleve: z.string(),
  conseil_parent: z.string(),
  references: z.array(z.object({
    reference_id: z.string(),
    topic_slug: z.string(),
    result: z.enum(["correct", "partial", "incorrect", "not_visible"]),
    evidence: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
    student_answer: z.string().optional().default(""),
    expected_answer: z.string().optional().default(""),
    explanation: z.string().optional().default(""),
  })),
  topic_assessments: z.array(topicAssessmentSchema).default([]),
});

const geminiPretProgramSchema = z.object({
  points_forts: z.array(z.string()),
  vigilance: z.array(z.string()),
  conseil_eleve: z.string(),
  conseil_parent: z.string(),
  references: z.array(z.object({
    reference_id: z.string(),
    topic_slug: z.string(),
    result: z.enum(["correct", "partial", "incorrect", "not_visible"]),
    evidence: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
    student_answer: z.string().optional().default(""),
    expected_answer: z.string().optional().default(""),
    explanation: z.string().optional().default(""),
  })),
  topic_assessments: z.array(topicAssessmentSchema).default([]),
});

type GeminiDiagnosticPayload = z.infer<typeof geminiDiagnosticSchema>;
type GeminiPretProgramPayload = z.infer<typeof geminiPretProgramSchema>;

function toStringArray(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) {
    return value
      .map((item) => typeof item === "string" ? item.trim() : "")
      .filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : fallback;
  }
  return fallback;
}

function toConfidence(value: unknown): "high" | "medium" | "low" {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "low";
}

function toControlledDepth(value: unknown, fallback: ControlledDepth): ControlledDepth {
  if (value === "FOUNDATIONS" || value === "CONSOLIDATION" || value === "VALIDATION") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["foundation", "foundations", "bases", "base", "reprise"].includes(normalized)) return "FOUNDATIONS";
    if (["consolidation", "consolider", "reinforcement", "renforcement"].includes(normalized)) return "CONSOLIDATION";
    if (["validation", "mastery", "maitrise", "maitrisé", "maitrisee"].includes(normalized)) return "VALIDATION";
  }
  return fallback;
}

function toLessonAi(value: unknown, topicSlug: string, fallbackReason: string): LessonAi {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidate = value as Record<string, unknown>;
    const title = typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() : null;
    const explanation = typeof candidate.explanation === "string" && candidate.explanation.trim()
      ? candidate.explanation.trim()
      : typeof candidate.lesson === "string" && candidate.lesson.trim()
        ? candidate.lesson.trim()
        : null;
    const rawDuration = typeof candidate.duration_minutes === "number"
      ? candidate.duration_minutes
      : typeof candidate.duration_minutes === "string"
        ? Number(candidate.duration_minutes)
        : typeof candidate.duration === "number"
          ? candidate.duration
          : typeof candidate.duration === "string"
            ? Number(candidate.duration)
            : null;
    const examples = toStringArray(candidate.examples, []).slice(0, 2);
    if (title && explanation) {
      return {
        title,
        duration_minutes: Number.isFinite(rawDuration) ? Math.max(1, Math.min(5, Math.round(rawDuration as number))) : 5,
        explanation,
        examples,
      };
    }
  }
  if (typeof value === "string" && value.trim()) {
    const fallback = buildFallbackLesson(topicSlug, fallbackReason);
    return {
      ...fallback,
      explanation: value.trim(),
    };
  }
  return buildFallbackLesson(topicSlug, fallbackReason);
}

function toFollowUpQuestions(value: unknown, fallbackTopicSlug: string) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string" && item.trim()) {
        return {
          topic_slug: fallbackTopicSlug,
          question: item.trim(),
        };
      }
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const candidate = item as Record<string, unknown>;
        const question = typeof candidate.question === "string" && candidate.question.trim() ? candidate.question.trim() : "";
        if (!question) return null;
        const topicSlug = typeof candidate.topic_slug === "string" && diagnosticTopicOrder.includes(candidate.topic_slug)
          ? candidate.topic_slug
          : fallbackTopicSlug;
        return { topic_slug: topicSlug, question };
      }
      return null;
    })
    .filter((item): item is FollowUpQuestion => item !== null)
    .slice(0, 4);
}

function normalizeDiagnosticReference(rawReference: unknown, index: number) {
  const fallbackReference = diagnosticReferential[index] ?? diagnosticReferential[0];
  const candidate = rawReference && typeof rawReference === "object" && !Array.isArray(rawReference)
    ? rawReference as Record<string, unknown>
    : {};
  const referenceId = typeof candidate.reference_id === "string" && candidate.reference_id.trim()
    ? candidate.reference_id.trim()
    : fallbackReference.diagnostic_ref_id;
  const referentialMatch = diagnosticReferential.find((item) => item.diagnostic_ref_id === referenceId) ?? fallbackReference;
  const topicSlug = typeof candidate.topic_slug === "string" && diagnosticTopicOrder.includes(candidate.topic_slug)
    ? candidate.topic_slug
    : referentialMatch.topic_id;
  const rawResult = typeof candidate.result === "string" ? candidate.result.trim().toLowerCase() : "";
  const result = rawResult === "correct" || rawResult === "partial" || rawResult === "incorrect" || rawResult === "not_visible"
    ? rawResult
    : "not_visible";
  const evidence = typeof candidate.evidence === "string" && candidate.evidence.trim()
    ? candidate.evidence.trim()
    : "Aucune preuve textuelle fiable extraite de la copie.";
  return {
    reference_id: referentialMatch.diagnostic_ref_id,
    topic_slug: topicSlug,
    result,
    evidence,
    student_answer: typeof candidate.student_answer === "string" ? candidate.student_answer : "",
    expected_answer: typeof candidate.expected_answer === "string" ? candidate.expected_answer : "",
    explanation: typeof candidate.explanation === "string" && candidate.explanation.trim()
      ? candidate.explanation.trim()
      : evidence,
    confidence: toConfidence(candidate.confidence),
  } satisfies GeminiDiagnosticPayload["references"][number];
}

function normalizeDiagnosticAssessment(rawAssessment: unknown, fallbackTopicSlug: string, fallbackMastery: "maitrise" | "a_renforcer" | "a_reprendre") {
  const candidate = rawAssessment && typeof rawAssessment === "object" && !Array.isArray(rawAssessment)
    ? rawAssessment as Record<string, unknown>
    : {};
  const topicSlug = typeof candidate.topic_slug === "string" && diagnosticTopicOrder.includes(candidate.topic_slug)
    ? candidate.topic_slug
    : fallbackTopicSlug;
  const fallbackReason = typeof candidate.reason === "string" && candidate.reason.trim()
    ? candidate.reason.trim()
    : "La copie suggere une fragilite sur cette notion.";
  const depth = toControlledDepth(candidate.depth, masteryToDepth(fallbackMastery));
  return {
    topic_slug: topicSlug,
    depth,
    confidence: toConfidence(candidate.confidence),
    reason: fallbackReason,
    lesson_ai: toLessonAi(candidate.lesson_ai, topicSlug, fallbackReason),
    needs_follow_up: Boolean(candidate.needs_follow_up),
    follow_up_topics: uniqueStrings(toStringArray(candidate.follow_up_topics, []).filter((item) => diagnosticTopicOrder.includes(item))),
    follow_up_questions: toFollowUpQuestions(candidate.follow_up_questions, topicSlug),
  } satisfies z.infer<typeof topicAssessmentSchema>;
}

function normalizeGeminiDiagnosticPayload(raw: unknown): GeminiDiagnosticPayload {
  const parsed = geminiDiagnosticSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const candidate = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const normalizedReferencesSource = Array.isArray(candidate.references) ? candidate.references : [];
  const references = (normalizedReferencesSource.length ? normalizedReferencesSource : diagnosticReferential).map((item, index) =>
    normalizeDiagnosticReference(item, index),
  );
  const referenceMastery = new Map<string, "maitrise" | "a_renforcer" | "a_reprendre">();
  for (const reference of references) {
    const mastery = reference.result === "correct"
      ? "maitrise"
      : reference.result === "partial"
        ? "a_renforcer"
        : "a_reprendre";
    if (!referenceMastery.has(reference.topic_slug) || mastery === "a_reprendre") {
      referenceMastery.set(reference.topic_slug, mastery);
    }
  }
  const normalizedAssessmentsSource = Array.isArray(candidate.topic_assessments) ? candidate.topic_assessments : [];
  const topic_assessments = normalizedAssessmentsSource
    .map((item, index) => {
      const fallbackTopicSlug = references[index]?.topic_slug ?? diagnosticTopicOrder[index % diagnosticTopicOrder.length];
      const fallbackMastery = referenceMastery.get(fallbackTopicSlug) ?? "a_renforcer";
      return normalizeDiagnosticAssessment(item, fallbackTopicSlug, fallbackMastery);
    })
    .filter((item, index, array) => array.findIndex((candidateItem) => candidateItem.topic_slug === item.topic_slug) === index);

  return geminiDiagnosticSchema.parse({
    points_forts: toStringArray(candidate.points_forts, ["Copie recue pour le diagnostic."]),
    vigilance: toStringArray(candidate.vigilance, ["Certaines reponses demandent une verification pedagogique plus fine."]),
    conseil_eleve: typeof candidate.conseil_eleve === "string" && candidate.conseil_eleve.trim()
      ? candidate.conseil_eleve.trim()
      : "Refais calmement les questions du diagnostic en montrant chaque etape.",
    conseil_parent: typeof candidate.conseil_parent === "string" && candidate.conseil_parent.trim()
      ? candidate.conseil_parent.trim()
      : "L'analyse a ete normalisee cote serveur pour conserver un resultat exploitable.",
    references,
    topic_assessments,
  });
}

function normalizePretProgramReference(rawReference: unknown, fallbackTopicSlug: string, fallbackReferenceId: string) {
  const candidate = rawReference && typeof rawReference === "object" && !Array.isArray(rawReference)
    ? rawReference as Record<string, unknown>
    : {};
  const referenceId = typeof candidate.reference_id === "string" && candidate.reference_id.trim()
    ? candidate.reference_id.trim()
    : fallbackReferenceId;
  const topicSlug = typeof candidate.topic_slug === "string" && diagnosticTopicOrder.includes(candidate.topic_slug)
    ? candidate.topic_slug
    : fallbackTopicSlug;
  const rawResult = typeof candidate.result === "string" ? candidate.result.trim().toLowerCase() : "";
  const result = rawResult === "correct" || rawResult === "partial" || rawResult === "incorrect" || rawResult === "not_visible"
    ? rawResult
    : "not_visible";
  const evidence = typeof candidate.evidence === "string" && candidate.evidence.trim()
    ? candidate.evidence.trim()
    : "Aucune preuve textuelle fiable extraite de la copie.";
  return {
    reference_id: referenceId,
    topic_slug: topicSlug,
    result,
    evidence,
    confidence: toConfidence(candidate.confidence),
    student_answer: typeof candidate.student_answer === "string" ? candidate.student_answer.trim() : "",
    expected_answer: typeof candidate.expected_answer === "string" ? candidate.expected_answer.trim() : "",
    explanation: typeof candidate.explanation === "string" && candidate.explanation.trim()
      ? candidate.explanation.trim()
      : evidence,
  } satisfies GeminiPretProgramPayload["references"][number];
}

function normalizeGeminiPretProgramPayload(raw: unknown, expectedTopics: string[], expectedItems: ExpectedGuideItem[] = []): GeminiPretProgramPayload {
  const parsed = geminiPretProgramSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const candidate = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const fallbackTopics = expectedTopics.length ? expectedTopics : diagnosticTopicOrder.slice(0, 1);
  const normalizedReferencesSource = Array.isArray(candidate.references) ? candidate.references : [];
  const references = (normalizedReferencesSource.length ? normalizedReferencesSource : (expectedItems.length ? expectedItems : fallbackTopics)).map((item, index) =>
    normalizePretProgramReference(
      item,
      expectedItems[index]?.topic_slug ?? fallbackTopics[index % fallbackTopics.length],
      expectedItems[index]?.reference_id ?? `SIM-${index + 1}`,
    ),
  );
  const referenceMastery = new Map<string, "maitrise" | "a_renforcer" | "a_reprendre">();
  for (const reference of references) {
    const mastery = reference.result === "correct"
      ? "maitrise"
      : reference.result === "partial" || reference.result === "not_visible"
        ? "a_renforcer"
        : "a_reprendre";
    if (!referenceMastery.has(reference.topic_slug) || mastery === "a_reprendre") {
      referenceMastery.set(reference.topic_slug, mastery);
    }
  }
  const normalizedAssessmentsSource = Array.isArray(candidate.topic_assessments) ? candidate.topic_assessments : [];
  const topic_assessments = normalizedAssessmentsSource
    .map((item, index) => {
      const fallbackTopicSlug = references[index]?.topic_slug ?? fallbackTopics[index % fallbackTopics.length];
      const fallbackMastery = referenceMastery.get(fallbackTopicSlug) ?? "a_renforcer";
      return normalizeDiagnosticAssessment(item, fallbackTopicSlug, fallbackMastery);
    })
    .filter((item, index, array) => array.findIndex((candidateItem) => candidateItem.topic_slug === item.topic_slug) === index);

  return geminiPretProgramSchema.parse({
    points_forts: toStringArray(candidate.points_forts, ["Copie recue pour la séance du programme personnalisé."]),
    vigilance: toStringArray(candidate.vigilance, ["Certaines réponses demandent une vérification pédagogique plus fine."]),
    conseil_eleve: typeof candidate.conseil_eleve === "string" && candidate.conseil_eleve.trim()
      ? candidate.conseil_eleve.trim()
      : "Reprends calmement la méthode du jour dans le guide et refais chaque étape.",
    conseil_parent: typeof candidate.conseil_parent === "string" && candidate.conseil_parent.trim()
      ? candidate.conseil_parent.trim()
      : "L'analyse a été normalisée côté serveur pour conserver un résultat exploitable.",
    references,
    topic_assessments,
  });
}

function extractExpectedTopicSlugs(context: PedagogicalContext) {
  if (!context?.metadata || typeof context.metadata !== "object" || Array.isArray(context.metadata)) return [];
  const rawTopics = (context.metadata as { expected_topic_slugs?: unknown }).expected_topic_slugs;
  if (!Array.isArray(rawTopics)) return [];
  return uniqueStrings(rawTopics.filter((item): item is string => typeof item === "string").filter((item) => diagnosticTopicOrder.includes(item)));
}

function extractExpectedGuideContext(context: PedagogicalContext): ExpectedGuideContextSnapshot | null {
  if (!context?.metadata || typeof context.metadata !== "object" || Array.isArray(context.metadata)) return null;
  const metadata = context.metadata as Record<string, unknown>;
  const expectedItems = Array.isArray(metadata.expected_items)
    ? metadata.expected_items
      .filter((item): item is ExpectedGuideItem => Boolean(item && typeof item === "object" && !Array.isArray(item)))
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
        scoring_rules: item.scoring_rules && typeof item.scoring_rules === "object" && !Array.isArray(item.scoring_rules) ? item.scoring_rules : {},
        common_errors: Array.isArray(item.common_errors) ? item.common_errors.map(String) : [],
        correction_ref: typeof item.correction_ref === "string" ? item.correction_ref : null,
        answer_status: typeof item.answer_status === "string" ? item.answer_status : null,
        page_reference: typeof item.page_reference === "string" ? item.page_reference : null,
      }))
      .filter((item) => item.reference_id.length > 0 && item.prompt_text.length > 0)
    : [];
  return {
    expected_document_type: metadata.expected_document_type === "DIAGNOSTIC" || metadata.expected_document_type === "PROGRAM_DAY" || metadata.expected_document_type === "FINAL_TEST"
      ? metadata.expected_document_type
      : null,
    day_reference: typeof metadata.day_reference === "string" ? metadata.day_reference : null,
    section_code: typeof metadata.section_code === "string" ? metadata.section_code : null,
    section_label: typeof metadata.section_label === "string" ? metadata.section_label : null,
    level_code: typeof metadata.level_code === "string" ? metadata.level_code : null,
    level_label: typeof metadata.level_label === "string" ? metadata.level_label : null,
    expected_reference_ids: Array.isArray(metadata.expected_reference_ids) ? metadata.expected_reference_ids.map(String) : expectedItems.map((item) => item.reference_id),
    expected_items: expectedItems,
    reference_lookup_status: metadata.reference_lookup_status === "reference_not_found" ? "reference_not_found" : "ok",
  };
}

function structuredResultToScore(result: "correct" | "partial" | "incorrect" | "not_visible") {
  if (result === "correct") return 100;
  if (result === "partial") return 60;
  if (result === "incorrect") return 20;
  return 40;
}

function buildPretProgramLocalPayload(expectedTopics: string[], expectedItems: ExpectedGuideItem[] = []): GeminiPretProgramPayload {
  return {
    points_forts: ["Copie fournie pour la séance du programme personnalisé."],
    vigilance: ["Analyse locale de développement utilisée faute de Gemini."],
    conseil_eleve: "Reprends calmement la méthode du jour en suivant le guide étape par étape.",
    conseil_parent: "Cette analyse locale sert uniquement à débloquer le développement.",
    references: (expectedItems.length > 0 ? expectedItems : expectedTopics.map((topicSlug, index) => ({
      reference_id: `SIM-${index + 1}`,
      topic_slug: topicSlug,
      expected_answer: "",
    }))).map((item, index) => ({
      reference_id: item.reference_id,
      topic_slug: item.topic_slug ?? expectedTopics[index % Math.max(1, expectedTopics.length)],
      result: index % 2 === 0 ? "partial" : "correct",
      evidence: "Simulation locale de développement.",
      confidence: "low" as const,
      student_answer: "",
      expected_answer: item.expected_answer ?? "",
      explanation: "Simulation locale de développement.",
    })),
    topic_assessments: [],
  };
}

async function buildMultimodalParts(files: AnalysisFile[]) {
  const limited = files.slice(0, 4);
  return Promise.all(limited.map(async (file) => ({
    inlineData: {
      mimeType: file.type,
      data: Buffer.from(await file.arrayBuffer()).toString("base64"),
    },
  })));
}

function formatPedagogicalContext(context: PedagogicalContext) {
  if (!context) {
    return "Contexte guide: travail realise dans le guide officiel. Analyse la copie, la methode et les erreurs sans inventer le texte des exercices.";
  }
  return `Contexte guide:
Jour: ${context.dayNumber ?? "non precise"}${context.dayTitle ? ` - ${context.dayTitle}` : ""}.
Objectif du jour: ${context.dayObjective ?? "non precise"}.
Type d'activite: ${context.itemType}.
Titre de l'activite: ${context.title ?? "non precise"}.
Consigne connue: ${context.prompt}.
Reference guide: ${context.guideReference || "non precisee"}.
Reference correction: ${context.correctionReference ?? "non precisee"}.
Difficulte: ${context.difficultyLabel ?? "non precisee"}.
Metadonnees: ${JSON.stringify(context.metadata ?? {})}.`;
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
}

function masteryToDepth(mastery: "maitrise" | "a_renforcer" | "a_reprendre"): ControlledDepth {
  if (mastery === "a_reprendre") return "FOUNDATIONS";
  if (mastery === "a_renforcer") return "CONSOLIDATION";
  return "VALIDATION";
}

function buildFallbackLesson(topicSlug: string, reason: string): LessonAi {
  const topicLabel = topicLabels[topicSlug] ?? topicSlug;
  return {
    title: `Lecon IA - ${topicLabel}`,
    duration_minutes: 4,
    explanation: `On reprend ${topicLabel.toLowerCase()} à partir de l'erreur observée : ${reason} Reviens à la méthode, puis refais un exemple simple étape par étape.`,
    examples: [`Refais un exemple court de ${topicLabel.toLowerCase()} en écrivant chaque étape utile.`],
  };
}

function serializeGuideRoute(recommendation: GuideRecommendation | null): SerializedGuideRoute | null {
  if (!recommendation) return null;
  return {
    day_number: recommendation.dayNumber,
    day_title: recommendation.dayTitle,
    guide_title: recommendation.guideTitle,
    page_reference: `Pages ${recommendation.pageStart}-${recommendation.pageEnd}`,
    primary_part: recommendation.primaryPartLabel,
    primary_level: recommendation.primaryLevelLabel,
    mini_test_ref: recommendation.miniTestRef,
  };
}

function normalizeTopicAssessment(
  assessment: z.infer<typeof topicAssessmentSchema> | undefined,
  topicSlug: string,
  mastery: "maitrise" | "a_renforcer" | "a_reprendre",
  fallbackReason: string,
) {
  const depth = assessment?.depth ?? masteryToDepth(mastery);
  const recommendation = getGuideRecommendation(topicSlug, depth);
  return {
    depth,
    confidence: assessment?.confidence ?? "medium",
    reason: assessment?.reason ?? fallbackReason,
    lesson_ai: assessment?.lesson_ai ?? buildFallbackLesson(topicSlug, fallbackReason),
    needs_follow_up: assessment?.needs_follow_up ?? false,
    follow_up_topics: uniqueStrings((assessment?.follow_up_topics ?? []).filter((value) => diagnosticTopicOrder.includes(value))),
    follow_up_questions: (assessment?.follow_up_questions ?? []).filter((item) => diagnosticTopicOrder.includes(item.topic_slug)),
    guide_route: serializeGuideRoute(recommendation),
  };
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

function buildLocalDiagnosticSummary(topicResults: TopicAnalysisPayload[]) {
  const mastered = topicResults.filter((item) => item.mastery === "maitrise");
  const reinforce = topicResults.filter((item) => item.mastery === "a_renforcer");
  const revisit = topicResults.filter((item) => item.mastery === "a_reprendre");
  const masteredLabels = mastered.slice(0, 3).map((item) => item.topic_label.toLowerCase());
  const revisitLabels = revisit.slice(0, 4).map((item) => item.topic_label.toLowerCase());
  const reinforceLabels = reinforce.slice(0, 3).map((item) => item.topic_label.toLowerCase());
  const firstPriority = revisit[0] ?? reinforce[0] ?? null;
  const route = firstPriority?.guide_route;

  const sentences = [
    `Le diagnostic montre ${mastered.length} notions maîtrisées, ${reinforce.length} à renforcer et ${revisit.length} à reprendre.`,
    masteredLabels.length > 0
      ? `Parmi les acquis déjà validés, on retrouve notamment ${masteredLabels.join(", ")}.`
      : "Aucun bloc de maîtrise nette ne ressort encore de façon stable.",
    revisitLabels.length > 0
      ? `Les reprises prioritaires concernent surtout ${revisitLabels.join(", ")}.`
      : reinforceLabels.length > 0
        ? `Le travail va surtout porter sur la consolidation de ${reinforceLabels.join(", ")}.`
        : "Aucune lacune prioritaire n'a été détectée avant le test final.",
    route
      ? `Le programme commencera par la référence J${route.day_number} du guide avant le test Passerelle final.`
      : "Le programme se poursuivra vers la validation finale du guide.",
  ];

  return sentences.join(" ");
}

async function callGeminiDiagnosticSummary(topicResults: TopicAnalysisPayload[]) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || topicResults.length === 0) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const facts = topicResults.map((item) => ({
    topic_slug: item.topic_slug,
    topic_label: item.topic_label,
    mastery: item.mastery,
    score: item.score ?? null,
    depth: item.depth,
    guide_reference: item.guide_route ? {
      day_number: item.guide_route.day_number,
      page_reference: item.guide_route.page_reference,
    } : null,
  }));

  try {
    const response = await fetchGeminiJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        contents: [{
          parts: [{
            text: `Tu rédiges un très court résumé ELAN IA à partir d'un résultat structuré.

Contraintes :
- 3 à 5 phrases maximum
- ton clair, pédagogique, factuel
- le résumé doit être cohérent avec les chiffres réels
- ne dis pas "bonne progression générale", "solides acquis" ou équivalent si les lacunes restent nombreuses
- mentionne quelques notions maîtrisées réelles et les priorités principales réelles
- n'invente jamais de page ni de jour
- si une référence guide est présente dans les faits, tu peux citer uniquement la forme exacte J1, J2, J14, etc.
- retourne uniquement un JSON valide : {"summary":"..."}

Faits:
${JSON.stringify(facts)}`
          }],
        }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      },
      30000,
    );
    if (!response.ok) return null;
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as { summary?: unknown };
    return typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : null;
  } catch {
    return null;
  }
}

async function callGeminiPractice(student: StudentForAnalysis, submission: SubmissionForAnalysis, files: AnalysisFile[], context: PedagogicalContext) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const fileList = (submission.file_names ?? []).join(", ") || "Aucun nom de fichier";
  const allowedTopics = uniqueStrings([student.current_topic_slug, ...diagnosticTopicOrder]);
  const prompt = `Tu es le raisonneur pedagogique d'ELAN.

Principe produit:
- ELAN APP = GPS pedagogique
- GUIDE = source officielle du contenu
- Toi = raisonneur, explicateur, detecteur de lacunes

Tu peux:
- lire la copie
- analyser la methode
- distinguer erreur de resultat, erreur partielle, mauvaise methode
- choisir uniquement parmi les topics existants
- proposer une courte lecon IA
- generer 2 a 4 questions de clarification si l'analyse est ambiguë

Tu ne peux pas:
- inventer un topic
- inventer une page, un jour ou un exercice du guide

Retourne uniquement un JSON valide avec:
score, status, points_forts, erreurs, notions_a_revoir, conseil_eleve, conseil_parent, exercices_recommandes, score_fiable,
topic_assessments: Array<{
  topic_slug,
  depth,
  confidence,
  reason,
  lesson_ai,
  needs_follow_up,
  follow_up_topics,
  follow_up_questions
}>

Les topic_slug autorises sont:
${allowedTopics.map((item) => `- ${item}`).join("\n")}

Si la copie ou l'enonce ne permet pas de noter proprement, mets score a null.
L'application gerera elle-meme le routage guide.

Eleve: ${student.first_name}.
Notion actuelle connue: ${student.current_topic_slug}.
Commentaire parent/eleve: ${submission.comment ?? "Aucun commentaire"}.
Fichiers envoyes: ${fileList}.

${formatPedagogicalContext(context)}`;

  try {
    const response = await fetchGeminiJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        contents: [{ parts: [{ text: prompt }, ...(await buildMultimodalParts(files))] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return geminiPracticeSchema.parse(JSON.parse(text));
  } catch (error) {
    console.error("[practice] Gemini unavailable", {
      studentId: student.id,
      submissionId: submission.id,
      error,
    });
    return null;
  }
}

async function callGeminiPretProgram(student: StudentForAnalysis, submission: SubmissionForAnalysis, files: AnalysisFile[], context: PedagogicalContext, expectedTopics: string[]) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const fileList = (submission.file_names ?? []).join(", ") || "Aucun nom de fichier";
  const referentialText = expectedTopics.map((item) => `- topic_slug=${item}`).join("\n");
  const prompt = `Tu es le raisonneur pedagogique d'ELAN pour une séance du programme personnalisé 14 jours.

Le guide est la source officielle du contenu. Tu ne dois pas inventer de nouvelle notion, de page ou de jour.
Travaille à partir de ce referentiel fermé des notions attendues du jour:
${referentialText}

Retourne uniquement un JSON valide avec:
- points_forts
- vigilance
- conseil_eleve
- conseil_parent
- references: une ligne par notion attendue visible sur la copie avec
  topic_slug, result, evidence, confidence
- topic_assessments: une ligne par topic plausible avec
  topic_slug, depth, confidence, reason, lesson_ai, needs_follow_up, follow_up_topics, follow_up_questions

Schema exact attendu:
{
  "points_forts": ["string"],
  "vigilance": ["string"],
  "conseil_eleve": "string",
  "conseil_parent": "string",
  "references": [
    {
      "topic_slug": "${expectedTopics[0] ?? student.current_topic_slug}",
      "result": "correct",
      "evidence": "string",
      "confidence": "high"
    }
  ],
  "topic_assessments": [
    {
      "topic_slug": "${expectedTopics[0] ?? student.current_topic_slug}",
      "depth": "FOUNDATIONS",
      "confidence": "medium",
      "reason": "string",
      "lesson_ai": {
        "title": "string",
        "duration_minutes": 5,
        "explanation": "string",
        "examples": ["string"]
      },
      "needs_follow_up": false,
      "follow_up_topics": ["${expectedTopics[0] ?? student.current_topic_slug}"],
      "follow_up_questions": [
        {
          "topic_slug": "${expectedTopics[0] ?? student.current_topic_slug}",
          "question": "string"
        }
      ]
    }
  ]
}

Règles strictes:
- utilise uniquement les topic_slug du referentiel
- si la copie est partiellement exploitable: result = partial
- si la notion n'est pas visible ou reste trop ambigüe: result = not_visible
- si l'analyse est ambigüe: confidence = low et propose 2 à 4 follow_up_questions courtes
- lesson_ai doit expliquer la difficulté réelle observée dans la copie, pas un template vague
- lesson_ai.explanation doit décrire l'erreur, rappeler la bonne méthode et rester concret sur une seule notion
- si la notion est maîtrisée, reason doit rester positif et factuel
- depth doit être exactement FOUNDATIONS, CONSOLIDATION ou VALIDATION
- n'ajoute aucun champ de routage guide: le serveur le calcule lui-même

Eleve: ${student.first_name}.
Commentaire parent/eleve: ${submission.comment ?? "Aucun commentaire"}.
Fichiers envoyes: ${fileList}.

${formatPedagogicalContext(context)}`;

  try {
    const response = await fetchGeminiJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        contents: [{ parts: [{ text: prompt }, ...(await buildMultimodalParts(files))] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return normalizeGeminiPretProgramPayload(JSON.parse(text), expectedTopics);
  } catch (error) {
    console.error("[pret-program] Gemini unavailable", {
      studentId: student.id,
      submissionId: submission.id,
      error,
    });
    return null;
  }
}

async function callGeminiDiagnostic(student: StudentForAnalysis, submission: SubmissionForAnalysis, files: AnalysisFile[]) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const referentialText = diagnosticReferential
    .map((item) => `- ${item.diagnostic_ref_id} | topic_slug=${item.topic_id} | jour=${item.day_number} | pages=${item.page_start}-${item.page_end} | question=${item.question_label}`)
    .join("\n");
  const prompt = `Tu es le raisonneur pedagogique du diagnostic Guide 1 d'ELAN.

Le guide est la source officielle du contenu. Tu ne dois pas inventer de nouvelle notion, de page ou de jour.
Travaille a partir de ce referentiel ferme:
${referentialText}

Retourne uniquement un JSON valide avec:
- points_forts
- vigilance
- conseil_eleve
- conseil_parent
- references: une ligne par DIAG vue sur la copie
- topic_assessments: une ligne par topic plausible avec
  topic_slug, depth, confidence, reason, lesson_ai, needs_follow_up, follow_up_topics, follow_up_questions

Schema exact attendu:
{
  "points_forts": ["string"],
  "vigilance": ["string"],
  "conseil_eleve": "string",
  "conseil_parent": "string",
  "references": [
    {
      "reference_id": "DIAG-01",
      "topic_slug": "relatifs_signes",
      "result": "correct",
      "evidence": "string",
      "confidence": "high"
    }
  ],
  "topic_assessments": [
    {
      "topic_slug": "relatifs_signes",
      "depth": "FOUNDATIONS",
      "confidence": "medium",
      "reason": "string",
      "lesson_ai": {
        "title": "string",
        "duration_minutes": 5,
        "explanation": "string",
        "examples": ["string"]
      },
      "needs_follow_up": false,
      "follow_up_topics": ["relatifs_signes"],
      "follow_up_questions": [
        {
          "topic_slug": "relatifs_signes",
          "question": "string"
        }
      ]
    }
  ]
}

Regles strictes:
- utilise uniquement les reference_id du referentiel
- utilise uniquement les topic_slug autorises
- si une question est illisible: result = not_visible
- si l'analyse est ambigue: confidence = low et propose 2 a 4 follow_up_questions courtes
- les follow_up_questions doivent rester dans le referentiel existant
- points_forts et vigilance doivent etre des tableaux de chaines, jamais une chaine simple
- lesson_ai doit etre un objet, jamais une chaine simple
- lesson_ai doit expliquer la difficulte reelle observee dans la copie ou dans les preuves, pas un template vague
- lesson_ai.explanation doit decrire l'erreur, rappeler la bonne methode et rester concret sur une seule notion
- si la notion est maitrisee, reason doit rester positif et factuel
- follow_up_questions doit etre un tableau d'objets { topic_slug, question }
- depth doit etre exactement FOUNDATIONS, CONSOLIDATION ou VALIDATION
- n'ajoute aucun champ de routage guide: le serveur le calcule lui-meme

Eleve: ${student.first_name}.
Commentaire parent/eleve: ${submission.comment ?? "Aucun commentaire"}.
Fichiers envoyes: ${(submission.file_names ?? []).join(", ") || "Aucun nom de fichier"}.`;
  try {
    const multimodalParts = await buildMultimodalParts(files);
    const response = await fetchGeminiJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        contents: [{ parts: [{ text: prompt }, ...multimodalParts] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      },
    );
    if (!response.ok) {
      console.error("[diagnostic] Gemini HTTP error", {
        studentId: student.id,
        submissionId: submission.id,
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }
    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("[diagnostic] Gemini empty response", {
        studentId: student.id,
        submissionId: submission.id,
        candidateCount: data.candidates?.length ?? 0,
      });
      return null;
    }
    try {
      return normalizeGeminiDiagnosticPayload(JSON.parse(text));
    } catch (error) {
      console.error("[diagnostic] Gemini payload normalization failed", {
        studentId: student.id,
        submissionId: submission.id,
        error,
        rawText: text,
      });
      throw error;
    }
  } catch (error) {
    console.error("[diagnostic] callGeminiDiagnostic:unhandled", {
      studentId: student.id,
      submissionId: submission.id,
      error,
    });
    return null;
  }
}

function localPracticeAnalysis(student: StudentForAnalysis, submission: SubmissionForAnalysis): PracticeAnalysisResult {
  const basis = Buffer.from((submission.comment ?? "") + (submission.file_names ?? []).join(",")).byteLength;
  const score = Math.max(8, Math.min(18, 10 + (basis % 9)));
  const mastery = score >= 15 ? "maitrise" : score >= 11 ? "a_renforcer" : "a_reprendre";
  const normalized = normalizeTopicAssessment(undefined, student.current_topic_slug, mastery, "Analyse locale utilisee faute de Gemini.");
  const topicLabel = topicLabels[student.current_topic_slug] ?? student.current_topic_slug;
  const topicResult: TopicAnalysisPayload = {
    topic_slug: student.current_topic_slug,
    topic_label: topicLabel,
    mastery,
    score: Math.round((score / 20) * 100),
    ...normalized,
  };
  return {
    score,
    status: score >= 15 ? "reussi" : score >= 11 ? "partiel" : "a_revoir",
    pointsForts: ["Travail remis avec serieux", `Bonne implication sur ${topicLabel}`],
    erreurs: score >= 15 ? ["Quelques details de presentation a consolider"] : ["Methode encore fragile sur certaines etapes"],
    notionsARevoir: mastery === "maitrise" ? [] : [topicLabel],
    conseilEleve: "Tu progresses. Refais calmement la methode, puis retourne dans le guide pour verifier l'etape qui bloque.",
    conseilParent: "Cette analyse locale sert uniquement a debloquer le developpement quand Gemini n'est pas disponible.",
    exercicesRecommandes: [],
    provider: "local",
    analysisKind: "practice",
    topicResults: [topicResult],
    nextSteps: mastery === "maitrise" ? [] : [{
      topic_slug: topicResult.topic_slug,
      topic_label: topicResult.topic_label,
      mastery: topicResult.mastery,
      depth: topicResult.depth,
      guide_route: topicResult.guide_route,
    }],
  };
}

async function buildPretProgramPracticeResult(
  student: StudentForAnalysis,
  submission: SubmissionForAnalysis,
  files: AnalysisFile[],
  context: PedagogicalContext,
): Promise<PracticeAnalysisResult | null> {
  const expectedTopics = extractExpectedTopicSlugs(context);
  const expectedGuideContext = extractExpectedGuideContext(context);
  const expectedItems = expectedGuideContext?.expected_items ?? [];
  if (expectedTopics.length === 0) {
    return buildPracticeResult(student, submission, files, null);
  }

  const geminiResult = await callGeminiPretProgram(student, submission, files, context, expectedTopics);
  const parsed = geminiResult ?? (
    process.env.NODE_ENV === "production"
      ? null
      : buildPretProgramLocalPayload(expectedTopics, expectedItems)
  );
  if (!parsed) return null;

  const previousScores = await getTopicProgressSnapshot(student.id);
  const assessmentByTopic = new Map(
    parsed.topic_assessments
      .filter((item) => expectedTopics.includes(item.topic_slug))
      .map((item) => [item.topic_slug, item]),
  );

  const topicResults = expectedTopics.map((topicSlug) => {
    const references = parsed.references.filter((item) => item.topic_slug === topicSlug);
    const scoredReferences = references.map((item) => structuredResultToScore(item.result));
    const rawAverage = scoredReferences.length
      ? Math.round(scoredReferences.reduce((sum, item) => sum + item, 0) / scoredReferences.length)
      : 40;
    const previousScore = previousScores.get(topicSlug);
    const finalScore = previousScore == null
      ? rawAverage
      : Math.round((rawAverage * 0.7) + (previousScore * 0.3));
    const fallbackMastery = references.some((item) => item.result === "incorrect")
      ? "a_reprendre"
      : references.some((item) => item.result === "partial" || item.result === "not_visible")
        ? "a_renforcer"
        : references.some((item) => item.result === "correct")
          ? "maitrise"
          : previousScore != null && previousScore >= 80
            ? "maitrise"
            : previousScore != null && previousScore < 45
              ? "a_reprendre"
              : "a_renforcer";
    const normalized = normalizeTopicAssessment(
      assessmentByTopic.get(topicSlug),
      topicSlug,
      fallbackMastery,
      references[0]?.evidence ?? "La copie montre encore une fragilité sur cette notion du programme personnalisé.",
    );
    const correctCount = references.filter((item) => item.result === "correct").length;
    const partialCount = references.filter((item) => item.result === "partial").length;
    const incorrectCount = references.filter((item) => item.result === "incorrect").length;
    const visibleCount = references.filter((item) => item.result !== "not_visible").length;
    const mastery = assessmentByTopic.has(topicSlug)
      ? normalized.depth === "VALIDATION"
        ? "maitrise"
        : normalized.depth === "FOUNDATIONS"
          ? "a_reprendre"
          : fallbackMastery
      : fallbackMastery;
    return {
      topic_slug: topicSlug,
      topic_label: topicLabels[topicSlug] ?? topicSlug,
      mastery,
      score: finalScore,
      evidence_count: references.length,
      correct_count: correctCount,
      partial_count: partialCount,
      incorrect_count: incorrectCount + Math.max(0, references.length - visibleCount - partialCount - correctCount),
      confidence: references.every((item) => item.confidence === "high")
        ? "high"
        : references.some((item) => item.confidence === "high" || item.confidence === "medium")
          ? "medium"
          : normalized.confidence,
      reason: normalized.reason,
      depth: normalized.depth,
      lesson_ai: mastery === "maitrise" ? null : normalized.lesson_ai,
      needs_follow_up: normalized.needs_follow_up,
      follow_up_topics: normalized.follow_up_topics,
      follow_up_questions: normalized.follow_up_questions,
      guide_route: normalized.guide_route,
      evidence: references.map((item) => item.evidence),
    } satisfies TopicAnalysisPayload;
  });

  const averageScore = topicResults.length
    ? Math.round(topicResults.reduce((sum, item) => sum + (item.score ?? 0), 0) / topicResults.length)
    : null;
  const scoreOn20 = averageScore == null ? null : Math.round(averageScore / 5);
  const hasRed = topicResults.some((item) => item.mastery === "a_reprendre");
  const hasOrange = topicResults.some((item) => item.mastery === "a_renforcer");

  return {
    score: scoreOn20,
    status: hasRed ? "a_revoir" : hasOrange ? "partiel" : "reussi",
    pointsForts: parsed.points_forts,
    erreurs: parsed.vigilance,
    notionsARevoir: topicResults.filter((item) => item.mastery !== "maitrise").map((item) => item.topic_label),
    conseilEleve: parsed.conseil_eleve,
    conseilParent: parsed.conseil_parent,
    exercicesRecommandes: [],
    provider: geminiResult ? "gemini" : "local",
    analysisKind: "practice",
    topicResults,
    nextSteps: topicResults
      .filter((item) => item.mastery !== "maitrise")
      .map((item) => ({
        topic_slug: item.topic_slug,
        topic_label: item.topic_label,
        mastery: item.mastery,
        depth: item.depth,
        guide_route: item.guide_route,
      })),
  };
}

async function buildDiagnosticResult(student: StudentForAnalysis, submission: SubmissionForAnalysis, files: AnalysisFile[]): Promise<DiagnosticAnalysisResult | null> {
  const geminiResult = await callGeminiDiagnostic(student, submission, files);
  const parsed = geminiResult ?? (
    process.env.NODE_ENV === "production"
      ? null
      : {
        points_forts: ["Copie fournie pour le diagnostic."],
        vigilance: ["Analyse locale de developpement utilisee faute de Gemini."],
        conseil_eleve: "Refais calmement les questions du diagnostic en expliquant chaque etape.",
        conseil_parent: "Cette analyse locale sert uniquement a debloquer le developpement.",
        references: diagnosticReferential.map((item, index) => ({
          reference_id: item.diagnostic_ref_id,
          topic_slug: item.topic_id,
          result: index % 3 === 0 ? "incorrect" : index % 2 === 0 ? "partial" : "correct",
          evidence: "Simulation locale de developpement.",
          confidence: "low" as const,
        })),
        topic_assessments: [],
      }
  );
  if (!parsed) return null;
  const previousScores = await getTopicProgressSnapshot(student.id);
  const topicResults = evaluateDiagnosticTopicResults(
    diagnosticReferential,
    parsed.references.map((item) => ({
      referenceId: item.reference_id,
      topicSlug: item.topic_slug,
      result: item.result,
      evidence: item.evidence,
      confidence: item.confidence,
    })),
    previousScores,
  );

  const assessmentByTopic = new Map(
    parsed.topic_assessments
      .filter((item) => diagnosticTopicOrder.includes(item.topic_slug))
      .map((item) => [item.topic_slug, item]),
  );

  const analysisTopicResults = topicResults.map((item) => {
    const fallbackReason = item.mastery === "maitrise"
      ? "Cette notion est maîtrisée. Aucun travail prioritaire nécessaire pour le moment."
      : item.incorrectCount > 0
        ? `Des erreurs reviennent sur cette notion. Preuves relevées : ${item.evidence.slice(0, 2).join(" | ") || "la méthode doit être reprise pas à pas"}.`
        : `La notion reste partielle. Preuves relevées : ${item.evidence.slice(0, 2).join(" | ") || "certaines étapes manquent ou restent fragiles"}.`;
    const normalized = normalizeTopicAssessment(assessmentByTopic.get(item.topicSlug), item.topicSlug, item.mastery, fallbackReason);
    return {
      topic_slug: item.topicSlug,
      topic_label: topicLabels[item.topicSlug] ?? item.topicSlug,
      mastery: item.mastery,
      score: item.score,
      evidence_count: item.evidenceCount,
      correct_count: item.correctCount,
      partial_count: item.partialCount,
      incorrect_count: item.incorrectCount,
      confidence: normalized.confidence,
      reason: normalized.reason,
      depth: normalized.depth,
      lesson_ai: item.mastery === "maitrise" ? null : normalized.lesson_ai,
      needs_follow_up: normalized.needs_follow_up,
      follow_up_topics: normalized.follow_up_topics,
      follow_up_questions: normalized.follow_up_questions,
      guide_route: normalized.guide_route,
      evidence: item.evidence,
      reference_ids: item.referenceIds,
      recommended_day_numbers: item.recommendedDayNumbers,
    } satisfies TopicAnalysisPayload;
  });

  const averageScore = topicResults.length
    ? Math.round(topicResults.reduce((sum, item) => sum + item.score, 0) / topicResults.length)
    : null;
  const scoreOn20 = averageScore == null ? null : Math.round(averageScore / 5);
  const hasRed = topicResults.some((item) => item.mastery === "a_reprendre");
  const hasOrange = topicResults.some((item) => item.mastery === "a_renforcer");
  const notionsARevoir = analysisTopicResults.filter((item) => item.mastery !== "maitrise").map((item) => item.topic_label);

  return {
    score: scoreOn20,
    status: hasRed ? "a_revoir" : hasOrange ? "partiel" : "reussi",
    pointsForts: parsed.points_forts,
    erreurs: parsed.vigilance,
    notionsARevoir,
    conseilEleve: parsed.conseil_eleve,
    conseilParent: parsed.conseil_parent,
    exercicesRecommandes: [],
    provider: geminiResult ? "gemini" : "local",
    analysisKind: "diagnostic",
    topicResults: analysisTopicResults,
    nextSteps: analysisTopicResults
      .filter((item) => item.mastery !== "maitrise")
      .map((item) => ({
        topic_slug: item.topic_slug,
        topic_label: item.topic_label,
        mastery: item.mastery,
        depth: item.depth,
        guide_route: item.guide_route,
      })),
    summaryAi: (await callGeminiDiagnosticSummary(analysisTopicResults)) ?? buildLocalDiagnosticSummary(analysisTopicResults),
  };
}

async function buildPracticeResult(student: StudentForAnalysis, submission: SubmissionForAnalysis, files: AnalysisFile[], context: PedagogicalContext): Promise<PracticeAnalysisResult | null> {
  if (context?.itemType === "guide_revision") {
    return buildPretProgramPracticeResult(student, submission, files, context);
  }

  const geminiResult = await callGeminiPractice(student, submission, files, context);
  if (!geminiResult) {
    if (process.env.NODE_ENV === "production") return null;
    return localPracticeAnalysis(student, submission);
  }

  const score = geminiResult.score_fiable === false ? null : geminiResult.score;
  const mastery: "maitrise" | "a_renforcer" | "a_reprendre" = score == null
    ? "a_renforcer"
    : score >= 15 ? "maitrise" : score >= 11 ? "a_renforcer" : "a_reprendre";
  const defaultTopic = diagnosticTopicOrder.includes(student.current_topic_slug) ? student.current_topic_slug : diagnosticTopicOrder[0];
  const selectedAssessments = geminiResult.topic_assessments.length
    ? geminiResult.topic_assessments.filter((item) => diagnosticTopicOrder.includes(item.topic_slug))
    : [{
      topic_slug: defaultTopic,
      depth: masteryToDepth(mastery),
      confidence: "medium" as const,
      reason: "La copie montre une fragilite sur cette notion.",
      lesson_ai: buildFallbackLesson(defaultTopic, "Reprends la methode pas a pas."),
      needs_follow_up: false,
      follow_up_topics: [],
      follow_up_questions: [],
    }];

  const topicResults = selectedAssessments.map((item) => {
    const normalized = normalizeTopicAssessment(item, item.topic_slug, mastery, item.reason);
    return {
      topic_slug: item.topic_slug,
      topic_label: topicLabels[item.topic_slug] ?? item.topic_slug,
      mastery,
      score: score == null ? null : Math.round((score / 20) * 100),
      ...normalized,
    } satisfies TopicAnalysisPayload;
  });

  return {
    score,
    status: geminiResult.status,
    pointsForts: geminiResult.points_forts,
    erreurs: geminiResult.erreurs,
    notionsARevoir: topicResults.filter((item) => item.mastery !== "maitrise").map((item) => item.topic_label),
    conseilEleve: geminiResult.conseil_eleve,
    conseilParent: score == null && !geminiResult.conseil_parent.includes("note fiable")
      ? `${geminiResult.conseil_parent} Je peux analyser la demarche, mais je n'ai pas assez d'informations pour attribuer une note fiable.`
      : geminiResult.conseil_parent,
    exercicesRecommandes: geminiResult.exercices_recommandes,
    provider: "gemini",
    analysisKind: "practice",
    topicResults,
    nextSteps: topicResults
      .filter((item) => item.mastery !== "maitrise")
      .map((item) => ({
        topic_slug: item.topic_slug,
        topic_label: item.topic_label,
        mastery: item.mastery,
        depth: item.depth,
        guide_route: item.guide_route,
      })),
  };
}

export async function analyzeSubmission(
  student: StudentForAnalysis,
  submission: SubmissionForAnalysis,
  files: AnalysisFile[] = [],
  options: AnalyzeSubmissionOptions = {},
) {
  const analysisKind = options.analysisKind ?? "practice";
  const persistProgress = options.persistProgress ?? true;
  const result: AnalysisResult | null = analysisKind === "diagnostic"
    ? await buildDiagnosticResult(student, submission, files)
    : await buildPracticeResult(student, submission, files, options.pedagogicalContext ?? null);

  if (!result) {
    console.error("[analysis] Analysis pipeline returned null", {
      analysisKind,
      studentId: student.id,
      submissionId: submission.id,
    });
    throw new Error("L'analyse n'a pas pu etre terminee. Reessayez dans quelques instants.");
  }

  const created = await createAnalysis({
    submissionId: submission.id,
    score: result.score,
    status: result.status,
    pointsForts: result.pointsForts,
    erreurs: result.erreurs,
    notionsARevoir: result.notionsARevoir,
    conseilEleve: result.conseilEleve,
    conseilParent: result.conseilParent,
    exercicesRecommandes: result.exercicesRecommandes,
    provider: result.provider,
    analysisKind: result.analysisKind,
    topicResults: result.topicResults,
    nextSteps: result.nextSteps,
    summaryAi: result.analysisKind === "diagnostic" ? result.summaryAi : null,
  });

  if (!persistProgress) {
    // Some validated uploads are informative only and must not mutate official progress.
  } else if (result.analysisKind === "diagnostic") {
    for (const topicResult of result.topicResults) {
      if (typeof topicResult.score === "number") {
        try {
          await upsertTopicProgress(student.id, topicResult.topic_slug, topicResult.score, topicResult.mastery);
        } catch (error) {
          console.error("[diagnostic] Topic progress upsert failed", {
            studentId: student.id,
            submissionId: submission.id,
            topicSlug: topicResult.topic_slug,
            score: topicResult.score,
            mastery: topicResult.mastery,
            error,
          });
          throw error;
        }
      }
    }
  } else if (result.topicResults.length > 0) {
    for (const topicResult of result.topicResults) {
      if (typeof topicResult.score === "number") {
        try {
          await upsertTopicProgress(student.id, topicResult.topic_slug, topicResult.score, topicResult.mastery);
        } catch (error) {
          console.error("[practice] Topic progress upsert failed", {
            studentId: student.id,
            submissionId: submission.id,
            topicSlug: topicResult.topic_slug,
            score: topicResult.score,
            mastery: topicResult.mastery,
            error,
          });
          throw error;
        }
      }
    }
  } else if (result.score != null) {
    try {
      await upsertTopicProgress(student.id, student.current_topic_slug, Math.round((result.score / 20) * 100));
    } catch (error) {
      console.error("[practice] Fallback topic progress upsert failed", {
        studentId: student.id,
        submissionId: submission.id,
        topicSlug: student.current_topic_slug,
        score: Math.round((result.score / 20) * 100),
        error,
      });
      throw error;
    }
  }

  try {
    await addNotificationIfAbsent({
      userId: student.parent_user_id,
      type: result.analysisKind === "diagnostic" ? "diagnostic_analyse" : "travail_analyse",
      message: result.analysisKind === "diagnostic"
        ? `${student.first_name} a recu son diagnostic initial ELAN et une lecon IA ciblee.`
        : `${student.first_name} a recu une analyse d'accompagnement et une lecon IA ciblee.`,
      studentId: student.id,
      dedupeKey: `${result.analysisKind}:${submission.id}`,
    });
  } catch (error) {
    console.error("[analysis] Notification insert failed", {
      analysisKind,
      studentId: student.id,
      submissionId: submission.id,
      userId: student.parent_user_id,
      error,
    });
    throw error;
  }
  return created;
}
