import { createAdminClient } from "@/lib/supabase/admin";
import { GUIDE_1_CODE, GUIDE_1_TITLE, NOT_DEFINED_IN_GUIDE, type GuideLevelCode, type GuidePartCode } from "@/lib/diagnostic-referential";

export type GuideReferenceDocumentType = "DIAGNOSTIC" | "PROGRAM_DAY" | "FINAL_TEST";
export type GuideReferenceLookupStatus = "ok" | "reference_not_found";

export type GuideDayReferenceRecord = {
  id: string;
  guide_code: string;
  guide_title: string;
  day_number: number;
  day_reference: string;
  day_title: string;
  mission: string | null;
  page_start: number;
  page_end: number;
  topic_slugs: string[];
  document_type: "PROGRAM_DAY" | "FINAL_TEST";
  is_final_test: boolean;
};

export type GuideReferenceItemRecord = {
  id: string;
  guide_day_id: string | null;
  reference_id: string;
  guide_code: string;
  document_type: GuideReferenceDocumentType;
  day_number: number | null;
  section_code: string | null;
  section_label: string | null;
  level_code: string | null;
  level_label: string | null;
  item_order: number;
  item_type: string;
  exercise_number: string | null;
  title: string | null;
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
  active: boolean;
  metadata: Record<string, unknown>;
};

export type GuideExpectedContext = {
  lookup_status: GuideReferenceLookupStatus;
  document_type: GuideReferenceDocumentType;
  guide_code: string;
  guide_title: string;
  day_number: number | null;
  day_reference: string | null;
  day_title: string | null;
  page_reference: string | null;
  section_code: string | null;
  section_label: string | null;
  level_code: string | null;
  level_label: string | null;
  expected_reference_ids: string[];
  topic_slugs: string[];
  expected_items: GuideReferenceItemRecord[];
  reason: string | null;
};

type GuideDayRow = {
  id: string;
  guide_code: string;
  guide_title: string;
  day_number: number;
  day_reference: string;
  day_title: string;
  mission: string | null;
  page_start: number;
  page_end: number;
  topic_slugs: unknown;
  document_type: "PROGRAM_DAY" | "FINAL_TEST";
  is_final_test: boolean;
};

type GuideItemRow = {
  id: string;
  guide_day_id: string | null;
  reference_id: string;
  guide_code: string;
  document_type: GuideReferenceDocumentType;
  day_number: number | null;
  section_code: string | null;
  section_label: string | null;
  level_code: string | null;
  level_label: string | null;
  item_order: number;
  item_type: string;
  exercise_number: string | null;
  title: string | null;
  prompt_text: string;
  topic_slug: string | null;
  skill_tested: string | null;
  expected_answer: string | null;
  accepted_answers: unknown;
  scoring_rules: unknown;
  common_errors: unknown;
  correction_ref: string | null;
  answer_status: string | null;
  page_reference: string | null;
  active: boolean;
  metadata: unknown;
};

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function normalizeDayRow(row: GuideDayRow): GuideDayReferenceRecord {
  return {
    id: row.id,
    guide_code: String(row.guide_code),
    guide_title: String(row.guide_title),
    day_number: Number(row.day_number),
    day_reference: String(row.day_reference),
    day_title: String(row.day_title),
    mission: row.mission == null ? null : String(row.mission),
    page_start: Number(row.page_start),
    page_end: Number(row.page_end),
    topic_slugs: toStringArray(row.topic_slugs),
    document_type: row.document_type,
    is_final_test: Boolean(row.is_final_test),
  };
}

function normalizeItemRow(row: GuideItemRow): GuideReferenceItemRecord {
  return {
    id: row.id,
    guide_day_id: row.guide_day_id,
    reference_id: String(row.reference_id),
    guide_code: String(row.guide_code),
    document_type: row.document_type,
    day_number: row.day_number == null ? null : Number(row.day_number),
    section_code: row.section_code == null ? null : String(row.section_code),
    section_label: row.section_label == null ? null : String(row.section_label),
    level_code: row.level_code == null ? null : String(row.level_code),
    level_label: row.level_label == null ? null : String(row.level_label),
    item_order: Number(row.item_order),
    item_type: String(row.item_type),
    exercise_number: row.exercise_number == null ? null : String(row.exercise_number),
    title: row.title == null ? null : String(row.title),
    prompt_text: String(row.prompt_text),
    topic_slug: row.topic_slug == null ? null : String(row.topic_slug),
    skill_tested: row.skill_tested == null ? null : String(row.skill_tested),
    expected_answer: row.expected_answer == null ? null : String(row.expected_answer),
    accepted_answers: toStringArray(row.accepted_answers),
    scoring_rules: row.scoring_rules && typeof row.scoring_rules === "object" && !Array.isArray(row.scoring_rules)
      ? row.scoring_rules as Record<string, unknown>
      : {},
    common_errors: toStringArray(row.common_errors),
    correction_ref: row.correction_ref == null ? null : String(row.correction_ref),
    answer_status: row.answer_status == null ? null : String(row.answer_status),
    page_reference: row.page_reference == null ? null : String(row.page_reference),
    active: Boolean(row.active),
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : {},
  };
}

function normalizePartCode(value: string | null | undefined): GuidePartCode | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized.includes("REACTIVE")) return "JE_REACTIVE";
  if (normalized.includes("ESSENTIEL")) return "JE_REPRENDS_L_ESSENTIEL";
  if (normalized.includes("MINI")) return "MINI_TEST";
  if (normalized.includes("NIVEAU") || normalized.includes("FIN_DE_4E")) return "JE_MONTE_AU_NIVEAU_FIN_DE_4E";
  return null;
}

function normalizeLevelCode(value: string | null | undefined): GuideLevelCode | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized.includes("NIVEAU_1") || normalized.includes("REACTIVATION")) return "NIVEAU_1";
  if (normalized.includes("NIVEAU_2")) return "NIVEAU_2";
  if (normalized.includes("NIVEAU_3") || normalized.includes("MAITRISE")) return "NIVEAU_3";
  if (normalized.includes("NIVEAU_4") || normalized.includes("DEFI")) return "NIVEAU_4";
  if (normalized.includes(NOT_DEFINED_IN_GUIDE)) return NOT_DEFINED_IN_GUIDE;
  return null;
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())).map((value) => value.trim()))];
}

function extractExerciseNumbers(raw: string | null | undefined) {
  if (!raw) return [];
  return unique((raw.match(/\d+/g) ?? []).map(String));
}

function compareExerciseOrder(item: GuideReferenceItemRecord) {
  const num = item.exercise_number == null ? NaN : Number(item.exercise_number.replace(/[^\d]/g, ""));
  return Number.isFinite(num) ? num : item.item_order;
}

function filterItemsByExercises(items: GuideReferenceItemRecord[], exerciseNumbers: string[]) {
  if (exerciseNumbers.length === 0) return items;
  const expected = new Set(exerciseNumbers);
  return items.filter((item) => item.exercise_number && expected.has(item.exercise_number));
}

export async function getGuideDayReference(dayNumber: number, guideCode = GUIDE_1_CODE) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("guide_day_reference")
    .select("id, guide_code, guide_title, day_number, day_reference, day_title, mission, page_start, page_end, topic_slugs, document_type, is_final_test")
    .eq("guide_code", guideCode)
    .eq("day_number", dayNumber)
    .eq("active", true)
    .maybeSingle<GuideDayRow>();
  if (error) throw error;
  return data ? normalizeDayRow(data) : null;
}

export async function getGuideReferenceItem(referenceId: string, guideCode = GUIDE_1_CODE) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("guide_reference_items")
    .select("id, guide_day_id, reference_id, guide_code, document_type, day_number, section_code, section_label, level_code, level_label, item_order, item_type, exercise_number, title, prompt_text, topic_slug, skill_tested, expected_answer, accepted_answers, scoring_rules, common_errors, correction_ref, answer_status, page_reference, active, metadata")
    .eq("guide_code", guideCode)
    .eq("reference_id", referenceId)
    .eq("active", true)
    .maybeSingle<GuideItemRow>();
  if (error) throw error;
  return data ? normalizeItemRow(data) : null;
}

export async function getGuideReferenceItemsForDiagnostic(guideCode = GUIDE_1_CODE) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("guide_reference_items")
    .select("id, guide_day_id, reference_id, guide_code, document_type, day_number, section_code, section_label, level_code, level_label, item_order, item_type, exercise_number, title, prompt_text, topic_slug, skill_tested, expected_answer, accepted_answers, scoring_rules, common_errors, correction_ref, answer_status, page_reference, active, metadata")
    .eq("guide_code", guideCode)
    .eq("document_type", "DIAGNOSTIC")
    .eq("active", true)
    .order("item_order", { ascending: true })
    .returns<GuideItemRow[]>();
  if (error) throw error;
  return (data ?? []).map(normalizeItemRow);
}

export async function getGuideReferenceItemsForDay(input: {
  dayNumber: number;
  sectionCode?: string | null;
  levelCode?: string | null;
  exerciseNumbers?: string[];
  guideCode?: string;
}) {
  const supabase = createAdminClient();
  let query = supabase
    .from("guide_reference_items")
    .select("id, guide_day_id, reference_id, guide_code, document_type, day_number, section_code, section_label, level_code, level_label, item_order, item_type, exercise_number, title, prompt_text, topic_slug, skill_tested, expected_answer, accepted_answers, scoring_rules, common_errors, correction_ref, answer_status, page_reference, active, metadata")
    .eq("guide_code", input.guideCode ?? GUIDE_1_CODE)
    .eq("day_number", input.dayNumber)
    .eq("active", true)
    .order("item_order", { ascending: true });

  const normalizedSection = normalizePartCode(input.sectionCode);
  if (normalizedSection) query = query.eq("section_code", normalizedSection);

  const normalizedLevel = normalizeLevelCode(input.levelCode);
  if (normalizedLevel && normalizedLevel !== NOT_DEFINED_IN_GUIDE) query = query.eq("level_code", normalizedLevel);

  const { data, error } = await query.returns<GuideItemRow[]>();
  if (error) throw error;

  const items = (data ?? []).map(normalizeItemRow);
  const filteredByExercises = filterItemsByExercises(items, input.exerciseNumbers ?? []);
  return filteredByExercises.sort((a, b) => compareExerciseOrder(a) - compareExerciseOrder(b));
}

export async function getExpectedGuideContext(input:
  | {
    mode: "diagnostic";
    guideCode?: string;
  }
  | {
    mode: "program_day";
    dayNumber: number;
    sectionCode?: string | null;
    levelCode?: string | null;
    exerciseNumbers?: string[];
    guideCode?: string;
  }) : Promise<GuideExpectedContext> {
  if (input.mode === "diagnostic") {
    const items = await getGuideReferenceItemsForDiagnostic(input.guideCode ?? GUIDE_1_CODE);
    return {
      lookup_status: items.length > 0 ? "ok" : "reference_not_found",
      document_type: "DIAGNOSTIC",
      guide_code: input.guideCode ?? GUIDE_1_CODE,
      guide_title: GUIDE_1_TITLE,
      day_number: null,
      day_reference: null,
      day_title: "Diagnostic initial",
      page_reference: "Pages 2-3",
      section_code: "DIAGNOSTIC",
      section_label: "Diagnostic initial",
      level_code: null,
      level_label: null,
      expected_reference_ids: items.map((item) => item.reference_id),
      topic_slugs: unique(items.map((item) => item.topic_slug)),
      expected_items: items,
      reason: items.length > 0 ? null : "REFERENCE_NOT_FOUND",
    };
  }

  const day = await getGuideDayReference(input.dayNumber, input.guideCode ?? GUIDE_1_CODE);
  const items = await getGuideReferenceItemsForDay({
    dayNumber: input.dayNumber,
    sectionCode: input.sectionCode,
    levelCode: input.levelCode,
    exerciseNumbers: input.exerciseNumbers,
    guideCode: input.guideCode ?? GUIDE_1_CODE,
  });
  const sectionCode = normalizePartCode(input.sectionCode) ?? (items[0]?.section_code ?? null);
  const levelCode = normalizeLevelCode(input.levelCode) ?? (items[0]?.level_code ?? null);
  return {
    lookup_status: day && items.length > 0 ? "ok" : "reference_not_found",
    document_type: input.dayNumber === 14 ? "FINAL_TEST" : "PROGRAM_DAY",
    guide_code: day?.guide_code ?? (input.guideCode ?? GUIDE_1_CODE),
    guide_title: day?.guide_title ?? GUIDE_1_TITLE,
    day_number: day?.day_number ?? input.dayNumber,
    day_reference: day?.day_reference ?? `J${input.dayNumber}`,
    day_title: day?.day_title ?? null,
    page_reference: day ? `Pages ${day.page_start}-${day.page_end}` : null,
    section_code: sectionCode,
    section_label: items[0]?.section_label ?? null,
    level_code: levelCode,
    level_label: items[0]?.level_label ?? null,
    expected_reference_ids: items.map((item) => item.reference_id),
    topic_slugs: unique([...(day?.topic_slugs ?? []), ...items.map((item) => item.topic_slug)]),
    expected_items: items,
    reason: day && items.length > 0 ? null : "REFERENCE_NOT_FOUND",
  };
}

export function inferGuideContextFromPretProgram(input: {
  dayNumber: number | null;
  recommendedPart?: string | null;
  recommendedLevel?: string | null;
  exerciseNumbers?: string | null;
}) {
  if (input.dayNumber == null) {
    return {
      dayNumber: null,
      sectionCode: null,
      levelCode: null,
      exerciseNumbers: [],
    };
  }
  return {
    dayNumber: input.dayNumber,
    sectionCode: normalizePartCode(input.recommendedPart),
    levelCode: normalizeLevelCode(input.recommendedLevel),
    exerciseNumbers: extractExerciseNumbers(input.exerciseNumbers),
  };
}
