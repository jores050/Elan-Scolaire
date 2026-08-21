import { getLearningJourneyState } from "@/lib/annual-program";
import { getExpectedGuideContext, inferGuideContextFromPretProgram } from "@/lib/guide-reference";
import { type ExpectedSubmissionContext } from "@/lib/submission-match";
import { topicLabels } from "@/lib/topics";

type OwnedStudent = {
  id: string;
  current_topic_slug: string;
};

type PedagogicalContext = {
  itemType: string;
  title: string | null;
  prompt: string;
  guideReference: string;
  correctionReference: string | null;
  difficultyLabel: string | null;
  metadata: Record<string, unknown>;
  dayNumber: number | null;
  dayTitle: string | null;
  dayObjective: string | null;
} | null;

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())).map((value) => value.trim()))];
}

function extractExerciseNumbers(values: Array<string | null | undefined>) {
  return unique(values.flatMap((value) => (value ?? "").match(/\d+/g) ?? []));
}

function buildFallbackFreePracticeContext(student: OwnedStudent): ExpectedSubmissionContext {
  const topicSlug = student.current_topic_slug;
  return {
    submission_kind: "practice",
    student_id: student.id,
    context_type: "free_practice",
    reference_lookup_status: "ok",
    expected_document_type: null,
    guide_code: null,
    expected_topic_slugs: topicSlug ? [topicSlug] : [],
    guide_reference: null,
    page_reference: null,
    day_reference: null,
    exercise_references: [],
    exercise_numbers: [],
    expected_reference_ids: [],
    section_code: null,
    section_label: null,
    level_code: null,
    level_label: null,
    expected_items: [],
    title: topicLabels[topicSlug] ?? "Travail libre",
    day_title: null,
    day_number: null,
    program_day_id: null,
    program_item_id: null,
    annual_week_id: null,
    annual_week_item_id: null,
    progression_eligible: false,
    pedagogical_prompt: "Travail libre sur papier. Donner un retour utile sans mettre à jour la progression officielle tant qu'aucune référence pédagogique fiable n'est rattachée.",
  };
}

export async function buildExpectedSubmissionContext(input: {
  student: OwnedStudent;
  submissionKind: "practice" | "diagnostic";
}) {
  if (input.submissionKind === "diagnostic") {
    const guideContext = await getExpectedGuideContext({ mode: "diagnostic" });
    return {
      submission_kind: "diagnostic",
      student_id: input.student.id,
      context_type: "diagnostic",
      reference_lookup_status: guideContext.lookup_status,
      expected_document_type: guideContext.document_type,
      guide_code: guideContext.guide_code,
      expected_topic_slugs: guideContext.topic_slugs,
      guide_reference: guideContext.guide_title,
      page_reference: guideContext.page_reference,
      day_reference: guideContext.day_reference,
      exercise_references: ["Diagnostic initial DIAG-01 à DIAG-26"],
      exercise_numbers: [],
      expected_reference_ids: guideContext.expected_reference_ids,
      section_code: guideContext.section_code,
      section_label: guideContext.section_label,
      level_code: guideContext.level_code,
      level_label: guideContext.level_label,
      expected_items: guideContext.expected_items.map((item) => ({
        reference_id: item.reference_id,
        document_type: item.document_type,
        day_number: item.day_number,
        section_code: item.section_code,
        section_label: item.section_label,
        level_code: item.level_code,
        level_label: item.level_label,
        exercise_number: item.exercise_number,
        item_type: item.item_type,
        prompt_text: item.prompt_text,
        topic_slug: item.topic_slug,
        skill_tested: item.skill_tested,
        expected_answer: item.expected_answer,
        accepted_answers: item.accepted_answers,
        scoring_rules: item.scoring_rules,
        common_errors: item.common_errors,
        correction_ref: item.correction_ref,
        answer_status: item.answer_status,
        page_reference: item.page_reference,
      })),
      title: "Diagnostic initial",
      day_title: guideContext.day_title ?? "Guide 1 - Diagnostic & Révision",
      day_number: null,
      program_day_id: null,
      program_item_id: null,
      annual_week_id: null,
      annual_week_item_id: null,
      progression_eligible: true,
      pedagogical_prompt: "Diagnostic initial Guide 1. Vérifier seulement si la copie correspond bien aux 26 questions du diagnostic et non à un autre travail.",
    } satisfies ExpectedSubmissionContext;
  }

  const journey = await getLearningJourneyState(input.student.id);
  if (journey.phase === "preparation" && journey.preparation.currentDay) {
    const day = journey.preparation.currentDay;
    const guideSelection = inferGuideContextFromPretProgram({
      dayNumber: day.day_number,
      recommendedPart: day.recommendedPart,
      recommendedLevel: day.recommendedLevel,
      exerciseNumbers: day.exerciseNumbers,
    });
    const guideContext = guideSelection.dayNumber == null
      ? null
      : await getExpectedGuideContext({
        mode: "program_day",
        dayNumber: guideSelection.dayNumber,
        sectionCode: guideSelection.sectionCode,
        levelCode: guideSelection.levelCode,
        exerciseNumbers: guideSelection.exerciseNumbers,
      });
    const exerciseItem = day.items.find((item) => item.item_type === "exercise") ?? null;
    const exerciseReferences = unique([
      day.exerciseNumbers ? `Exercices ${day.exerciseNumbers}` : null,
      ...day.items
        .filter((item) => item.item_type === "exercise")
        .map((item) => item.title ?? null),
    ]);
    return {
      submission_kind: "practice",
      student_id: input.student.id,
      context_type: "pret_program",
      reference_lookup_status: guideContext?.lookup_status ?? "reference_not_found",
      expected_document_type: guideContext?.document_type ?? null,
      guide_code: guideContext?.guide_code ?? null,
      expected_topic_slugs: unique(guideContext?.topic_slugs ?? day.topicSlugs),
      guide_reference: guideContext?.guide_title ?? day.guideLabel,
      page_reference: guideContext?.page_reference ?? day.pageReference,
      day_reference: guideContext?.day_reference ?? (day.day_number == null ? null : `J${day.day_number}`),
      exercise_references: exerciseReferences,
      exercise_numbers: extractExerciseNumbers([day.exerciseNumbers, ...exerciseReferences]),
      expected_reference_ids: guideContext?.expected_reference_ids ?? [],
      section_code: guideContext?.section_code ?? guideSelection.sectionCode,
      section_label: guideContext?.section_label ?? null,
      level_code: guideContext?.level_code ?? guideSelection.levelCode,
      level_label: guideContext?.level_label ?? null,
      expected_items: (guideContext?.expected_items ?? []).map((item) => ({
        reference_id: item.reference_id,
        document_type: item.document_type,
        day_number: item.day_number,
        section_code: item.section_code,
        section_label: item.section_label,
        level_code: item.level_code,
        level_label: item.level_label,
        exercise_number: item.exercise_number,
        item_type: item.item_type,
        prompt_text: item.prompt_text,
        topic_slug: item.topic_slug,
        skill_tested: item.skill_tested,
        expected_answer: item.expected_answer,
        accepted_answers: item.accepted_answers,
        scoring_rules: item.scoring_rules,
        common_errors: item.common_errors,
        correction_ref: item.correction_ref,
        answer_status: item.answer_status,
        page_reference: item.page_reference,
      })),
      title: day.title,
      day_title: day.title,
      day_number: day.day_number,
      program_day_id: day.id,
      program_item_id: exerciseItem?.id ?? null,
      annual_week_id: null,
      annual_week_item_id: null,
      progression_eligible: true,
      pedagogical_prompt: "Séance du programme personnalisé 14 jours. Vérifier si la copie correspond bien au jour et aux notions prévues avant de lancer l'analyse pédagogique.",
    } satisfies ExpectedSubmissionContext;
  }

  const annualSession = journey.phase === "annual_tracking" ? journey.annual.recommendedSession : null;
  if (!annualSession) {
    return buildFallbackFreePracticeContext(input.student);
  }

  if (annualSession.source === "annual") {
    return {
      submission_kind: "practice",
      student_id: input.student.id,
      context_type: "annual_tracking",
      reference_lookup_status: "ok",
      expected_document_type: null,
      guide_code: null,
      expected_topic_slugs: unique([annualSession.topic_slug]),
      guide_reference: annualSession.guide_reference,
      page_reference: annualSession.page_reference,
      day_reference: null,
      exercise_references: unique([annualSession.exercise_reference, annualSession.reference_label]),
      exercise_numbers: extractExerciseNumbers([annualSession.exercise_reference, annualSession.reference_label]),
      expected_reference_ids: [],
      section_code: null,
      section_label: null,
      level_code: null,
      level_label: null,
      expected_items: [],
      title: annualSession.title,
      day_title: annualSession.title,
      day_number: annualSession.week_number,
      program_day_id: null,
      program_item_id: null,
      annual_week_id: annualSession.week_id,
      annual_week_item_id: annualSession.week_item_id,
      progression_eligible: true,
      pedagogical_prompt: "Séance du suivi annuel 3e. Vérifier la cohérence de la copie avec la notion et la référence officielle sélectionnées par le serveur.",
    } satisfies ExpectedSubmissionContext;
  }

  const examTopics = annualSession.topic_slug
    ? [annualSession.topic_slug]
    : journey.annual.activeExamPlan?.items.map((item) => item.topic_slug).filter((value): value is string => Boolean(value)) ?? [];
  return {
    submission_kind: "practice",
    student_id: input.student.id,
    context_type: "exam_prep",
    reference_lookup_status: "ok",
    expected_document_type: null,
    guide_code: null,
    expected_topic_slugs: unique(examTopics),
    guide_reference: annualSession.guide_reference,
    page_reference: annualSession.page_reference,
    day_reference: null,
    exercise_references: unique([annualSession.exercise_reference, annualSession.reference_label]),
    exercise_numbers: extractExerciseNumbers([annualSession.exercise_reference, annualSession.reference_label]),
    expected_reference_ids: [],
    section_code: null,
    section_label: null,
    level_code: null,
    level_label: null,
    expected_items: [],
    title: annualSession.title,
    day_title: annualSession.reason,
    day_number: null,
    program_day_id: null,
    program_item_id: null,
    annual_week_id: null,
    annual_week_item_id: null,
    progression_eligible: false,
    pedagogical_prompt: "Révision ponctuelle avant devoir. Analyse autorisée si la copie correspond, mais sans mise à jour automatique de la progression officielle.",
  } satisfies ExpectedSubmissionContext;
}

export function buildPedagogicalContextFromExpectedContext(expectedContext: ExpectedSubmissionContext): PedagogicalContext {
  const metadata = {
    page_reference: expectedContext.page_reference,
    exercise_reference: expectedContext.exercise_references.join(" · ") || null,
    expected_topic_slugs: expectedContext.expected_topic_slugs,
    context_type: expectedContext.context_type,
    expected_document_type: expectedContext.expected_document_type ?? null,
    day_reference: expectedContext.day_reference ?? null,
    section_code: expectedContext.section_code ?? null,
    section_label: expectedContext.section_label ?? null,
    level_code: expectedContext.level_code ?? null,
    level_label: expectedContext.level_label ?? null,
    expected_reference_ids: expectedContext.expected_reference_ids ?? [],
    expected_items: expectedContext.expected_items ?? [],
    reference_lookup_status: expectedContext.reference_lookup_status ?? "ok",
  };

  if (expectedContext.context_type === "pret_program") {
    return {
      itemType: "guide_revision",
      title: expectedContext.title,
      prompt: expectedContext.pedagogical_prompt ?? "Travail réalisé dans le Guide 1 officiel. Analyse la copie sans inventer le texte exact des exercices.",
      guideReference: expectedContext.guide_reference ?? "Guide 1 - Diagnostic & Révision",
      correctionReference: null,
      difficultyLabel: null,
      metadata,
      dayNumber: expectedContext.day_number,
      dayTitle: expectedContext.day_title,
      dayObjective: null,
    };
  }

  return {
    itemType: expectedContext.context_type === "annual_tracking" ? "annual_tracking" : "paper_practice",
    title: expectedContext.title,
    prompt: expectedContext.pedagogical_prompt ?? "Travail réalisé sur papier à partir d'une référence pédagogique officielle. Analyse la copie sans inventer le texte exact des exercices.",
    guideReference: expectedContext.guide_reference ?? "Référence papier",
    correctionReference: null,
    difficultyLabel: null,
    metadata,
    dayNumber: expectedContext.day_number,
    dayTitle: expectedContext.day_title,
    dayObjective: null,
  };
}
