export const GUIDE_1_CODE = "guide-1-diagnostic-passerelle-3e-v2";
export const GUIDE_1_TITLE = "Guide 1 V2 - Diagnostic & Passerelle vers la 3e";
export const NOT_DEFINED_IN_GUIDE = "NOT_DEFINED_IN_GUIDE";

export type ControlledDepth = "FOUNDATIONS" | "CONSOLIDATION" | "VALIDATION";
export type GuidePartCode = "JE_REACTIVE" | "JE_REPRENDS_L_ESSENTIEL" | "JE_MONTE_AU_NIVEAU_FIN_DE_4E" | "MINI_TEST";
export type GuideLevelCode = "NIVEAU_1" | "NIVEAU_2" | "NIVEAU_3" | "NIVEAU_4" | typeof NOT_DEFINED_IN_GUIDE;

export type DiagnosticReference = {
  diagnostic_ref_id: string;
  question_order: number;
  question_label: string;
  topic_id: string;
  day_number: number;
  guide_code: string;
  guide_title: string;
  page_start: number;
  page_end: number;
  day_title: string;
  default_part: GuidePartCode | typeof NOT_DEFINED_IN_GUIDE;
  default_level: GuideLevelCode;
  weight: number | typeof NOT_DEFINED_IN_GUIDE;
  max_score: number | typeof NOT_DEFINED_IN_GUIDE;
  partial_scoring_rules: string;
  follow_up_group_id: string;
  notes: string;
};

export type RevisionTarget = {
  topic_id: string;
  day_number: number;
  day_title: string;
  guide_code: string;
  page_start: number;
  page_end: number;
  part_code: GuidePartCode;
  part_label: string;
  level_code: GuideLevelCode;
  level_label: string;
  exercise_start: number | typeof NOT_DEFINED_IN_GUIDE;
  exercise_end: number | typeof NOT_DEFINED_IN_GUIDE;
  mini_test_ref: string | typeof NOT_DEFINED_IN_GUIDE;
  correction_ref: string | typeof NOT_DEFINED_IN_GUIDE;
  is_minimum_required: boolean;
};

export type GuideRecommendation = {
  topicSlug: string;
  depth: ControlledDepth;
  dayNumber: number;
  dayTitle: string;
  guideCode: string;
  guideTitle: string;
  pageStart: number;
  pageEnd: number;
  primaryPartCode: GuidePartCode;
  primaryPartLabel: string;
  primaryLevelCode: GuideLevelCode;
  primaryLevelLabel: string;
  sequence: RevisionTarget[];
  miniTestRef: string | typeof NOT_DEFINED_IN_GUIDE;
};

type DayBlueprint = {
  dayNumber: number;
  dayTitle: string;
  pageStart: number;
  pageEnd: number;
  topics: string[];
  reactivationRange: [number, number];
  miniTestRange: [number, number];
  levelRanges: {
    NIVEAU_1: [number, number];
    NIVEAU_2: [number, number];
    NIVEAU_3: [number, number];
    NIVEAU_4: [number, number];
  };
};

const dayBlueprints: DayBlueprint[] = [
  { dayNumber: 1, dayTitle: "CALCUL NUMERIQUE : RELATIFS, SIGNES ET PRIORITES", pageStart: 4, pageEnd: 5, topics: ["relatifs_signes", "priorites_operatoires"], reactivationRange: [1, 3], miniTestRange: [1, 5], levelRanges: { NIVEAU_1: [1, 4], NIVEAU_2: [1, 3], NIVEAU_3: [1, 3], NIVEAU_4: [1, 3] } },
  { dayNumber: 2, dayTitle: "FRACTIONS ET NOMBRES RATIONNELS", pageStart: 6, pageEnd: 7, topics: ["fractions"], reactivationRange: [1, 3], miniTestRange: [1, 5], levelRanges: { NIVEAU_1: [1, 4], NIVEAU_2: [1, 3], NIVEAU_3: [1, 3], NIVEAU_4: [1, 3] } },
  { dayNumber: 3, dayTitle: "PUISSANCES ET CALCULS NUMERIQUES", pageStart: 8, pageEnd: 9, topics: ["puissances"], reactivationRange: [1, 3], miniTestRange: [1, 5], levelRanges: { NIVEAU_1: [1, 4], NIVEAU_2: [1, 3], NIVEAU_3: [1, 3], NIVEAU_4: [1, 3] } },
  { dayNumber: 4, dayTitle: "CALCUL LITTERAL : REDUIRE ET TRANSFORMER", pageStart: 10, pageEnd: 11, topics: ["calcul_litteral_reduction"], reactivationRange: [1, 3], miniTestRange: [1, 5], levelRanges: { NIVEAU_1: [1, 3], NIVEAU_2: [1, 3], NIVEAU_3: [1, 3], NIVEAU_4: [1, 3] } },
  { dayNumber: 5, dayTitle: "DEVELOPPEMENT ET IDENTITES REMARQUABLES", pageStart: 12, pageEnd: 13, topics: ["developpement", "identites_remarquables"], reactivationRange: [1, 3], miniTestRange: [1, 5], levelRanges: { NIVEAU_1: [1, 4], NIVEAU_2: [1, 3], NIVEAU_3: [1, 3], NIVEAU_4: [1, 3] } },
  { dayNumber: 6, dayTitle: "FACTORISATION : FACTEUR COMMUN ET IDENTITES REMARQUABLES", pageStart: 14, pageEnd: 15, topics: ["factorisation_facteur_commun", "factorisation_identites"], reactivationRange: [1, 3], miniTestRange: [1, 5], levelRanges: { NIVEAU_1: [1, 4], NIVEAU_2: [1, 4], NIVEAU_3: [1, 4], NIVEAU_4: [1, 3] } },
  { dayNumber: 7, dayTitle: "EQUATIONS, INEQUATIONS ET PROBLEMES", pageStart: 16, pageEnd: 17, topics: ["equations", "inequations"], reactivationRange: [1, 3], miniTestRange: [1, 5], levelRanges: { NIVEAU_1: [1, 4], NIVEAU_2: [1, 3], NIVEAU_3: [1, 3], NIVEAU_4: [1, 3] } },
  { dayNumber: 8, dayTitle: "PROPORTIONNALITE, RAPPORTS ET POURCENTAGES", pageStart: 18, pageEnd: 19, topics: ["proportionnalite", "pourcentages"], reactivationRange: [1, 3], miniTestRange: [1, 5], levelRanges: { NIVEAU_1: [1, 4], NIVEAU_2: [1, 3], NIVEAU_3: [1, 3], NIVEAU_4: [1, 3] } },
  { dayNumber: 9, dayTitle: "TRIANGLE RECTANGLE : PYTHAGORE ET RECIPROQUE", pageStart: 20, pageEnd: 21, topics: ["pythagore", "pythagore_reciproque"], reactivationRange: [1, 3], miniTestRange: [1, 5], levelRanges: { NIVEAU_1: [1, 3], NIVEAU_2: [1, 3], NIVEAU_3: [1, 3], NIVEAU_4: [1, 3] } },
  { dayNumber: 10, dayTitle: "GEOMETRIE PLANE ET CONSTRUCTIONS", pageStart: 22, pageEnd: 23, topics: ["geometrie_milieux"], reactivationRange: [1, 3], miniTestRange: [1, 5], levelRanges: { NIVEAU_1: [1, 4], NIVEAU_2: [1, 3], NIVEAU_3: [1, 3], NIVEAU_4: [1, 3] } },
  { dayNumber: 11, dayTitle: "REPERAGE, COORDONNEES ET PROJECTION", pageStart: 24, pageEnd: 25, topics: ["coordonnees_milieu"], reactivationRange: [1, 3], miniTestRange: [1, 5], levelRanges: { NIVEAU_1: [1, 3], NIVEAU_2: [1, 3], NIVEAU_3: [1, 3], NIVEAU_4: [1, 3] } },
  { dayNumber: 12, dayTitle: "TRANSLATIONS ET VECTEURS", pageStart: 26, pageEnd: 27, topics: ["vecteurs_chasles"], reactivationRange: [1, 3], miniTestRange: [1, 5], levelRanges: { NIVEAU_1: [1, 3], NIVEAU_2: [1, 3], NIVEAU_3: [1, 3], NIVEAU_4: [1, 3] } },
  { dayNumber: 13, dayTitle: "STATISTIQUES, GRANDEURS ET ESPACE", pageStart: 28, pageEnd: 29, topics: ["statistiques_moyenne", "statistiques_frequence", "grandeurs_espace"], reactivationRange: [1, 3], miniTestRange: [1, 5], levelRanges: { NIVEAU_1: [1, 4], NIVEAU_2: [1, 3], NIVEAU_3: [1, 3], NIVEAU_4: [1, 3] } },
];

const diagnosticDefinitions = [
  ["DIAG-01", 1, "Calculer : -7 + 12 - 9.", "relatifs_signes", 1, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J1 / Je reactive."],
  ["DIAG-02", 2, "Calculer : (-6) x (-4) / 3.", "relatifs_signes", 1, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J1 / Je reactive."],
  ["DIAG-03", 3, "Calculer : 18 - 3 x (2 + 4).", "priorites_operatoires", 1, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J1 / Je reactive."],
  ["DIAG-04", 4, "Calculer : 3/4 + 5/6.", "fractions", 2, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J2 / Je reactive."],
  ["DIAG-05", 5, "Calculer : 7/9 / 14/15.", "fractions", 2, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J2 / Je reactive."],
  ["DIAG-06", 6, "Simplifier : (2^5 x 2^3) / 2^4.", "puissances", 3, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J3 / Je reactive."],
  ["DIAG-07", 7, "Reduire : 4x^2 + 3x - 2x^2 + 5x - 7.", "calcul_litteral_reduction", 4, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J4 / Je reactive."],
  ["DIAG-08", 8, "Developper et reduire : 3(2x - 5) + 4x.", "developpement", 5, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J5 / Je reactive."],
  ["DIAG-09", 9, "Developper : (x + 3)(2x - 1).", "developpement", 5, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J5 / Je reactive."],
  ["DIAG-10", 10, "Developper : (2x - 5)^2.", "identites_remarquables", 5, NOT_DEFINED_IN_GUIDE, NOT_DEFINED_IN_GUIDE, "Competence presente en J5 sans routage plus fin explicite dans le PDF."],
  ["DIAG-11", 11, "Factoriser : 6x^2 + 9x.", "factorisation_facteur_commun", 6, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J6 / Je reactive."],
  ["DIAG-12", 12, "Factoriser : (x + 3)(3x - 2) + (x + 3)(2x - 3).", "factorisation_facteur_commun", 6, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J6 / Je reactive."],
  ["DIAG-13", 13, "Factoriser : x^2 - 25.", "factorisation_identites", 6, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J6 / Je reactive."],
  ["DIAG-14", 14, "Factoriser : x^2 + 10x + 25.", "factorisation_identites", 6, "JE_MONTE_AU_NIVEAU_FIN_DE_4E", "NIVEAU_1", "Repris textuellement en J6 / Niveau 1."],
  ["DIAG-15", 15, "Resoudre : 3(x + 2) = 2x + 11.", "equations", 7, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J7 / Je reactive."],
  ["DIAG-16", 16, "Resoudre : 5 - 2x < 12.", "inequations", 7, NOT_DEFINED_IN_GUIDE, NOT_DEFINED_IN_GUIDE, "Competence presente en J7 sans routage plus fin explicite dans le PDF."],
  ["DIAG-17", 17, "4 kg de riz coutent 2 400 F CFA. Combien coutent 7 kg ?", "proportionnalite", 8, NOT_DEFINED_IN_GUIDE, NOT_DEFINED_IN_GUIDE, "Competence presente en J8 sans enonce identique."],
  ["DIAG-18", 18, "Apres une reduction de 20 %, un article de 15 000 F CFA coute combien ?", "pourcentages", 8, NOT_DEFINED_IN_GUIDE, NOT_DEFINED_IN_GUIDE, "Competence presente en J8 sans enonce identique."],
  ["DIAG-19", 19, "Triangle rectangle, cotes 6 et 8 : hypotenuse.", "pythagore", 9, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J9 / Je reactive."],
  ["DIAG-20", 20, "Triangle 8, 15, 17 : determiner s'il est rectangle.", "pythagore_reciproque", 9, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J9 / Je reactive."],
  ["DIAG-21", 21, "Dans ABC, M et N milieux de [AB] et [AC], si BC = 12 cm, calculer MN.", "geometrie_milieux", 10, "JE_MONTE_AU_NIVEAU_FIN_DE_4E", "NIVEAU_2", "Repris textuellement en J10 / Niveau 2."],
  ["DIAG-22", 22, "A(-2 ; 4) et B(6 ; 0). Calculer les coordonnees du milieu de [AB].", "coordonnees_milieu", 11, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J11 / Je reactive."],
  ["DIAG-23", 23, "Completer la relation de Chasles : AB + BC = ...", "vecteurs_chasles", 12, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J12 / Je reactive."],
  ["DIAG-24", 24, "Calculer la moyenne de : 6 ; 8 ; 8 ; 10.", "statistiques_moyenne", 13, NOT_DEFINED_IN_GUIDE, NOT_DEFINED_IN_GUIDE, "Competence presente en J13 sans serie identique."],
  ["DIAG-25", 25, "Une valeur apparait 7 fois dans 20 valeurs. Donner sa frequence en pourcentage.", "statistiques_frequence", 13, NOT_DEFINED_IN_GUIDE, NOT_DEFINED_IN_GUIDE, "Competence presente en J13 sans enonce identique."],
  ["DIAG-26", 26, "Pyramide base 30 cm2 et hauteur 12 cm : calculer le volume.", "grandeurs_espace", 13, "JE_REACTIVE", NOT_DEFINED_IN_GUIDE, "Repris textuellement en J13 / Je reactive."],
] as const;

function labelForPart(partCode: GuidePartCode) {
  if (partCode === "JE_REACTIVE") return "Je reactive";
  if (partCode === "JE_REPRENDS_L_ESSENTIEL") return "Je reprends l'essentiel";
  if (partCode === "JE_MONTE_AU_NIVEAU_FIN_DE_4E") return "Je monte au niveau fin de 4e";
  return "Mini-test";
}

function labelForLevel(levelCode: GuideLevelCode) {
  if (levelCode === "NIVEAU_1") return "Niveau 1 - Reactivation";
  if (levelCode === "NIVEAU_2") return "Niveau 2 - Niveau attendu fin de 4e";
  if (levelCode === "NIVEAU_3") return "Niveau 3 - Maitrise";
  if (levelCode === "NIVEAU_4") return "Niveau 4 - Defi Passerelle 3e";
  return NOT_DEFINED_IN_GUIDE;
}

function miniTestRefForDay(day: DayBlueprint) {
  return `T${day.miniTestRange[0]}-T${day.miniTestRange[1]}`;
}

function buildRevisionTargetsForDay(day: DayBlueprint, topicId: string): RevisionTarget[] {
  return [
    {
      topic_id: topicId,
      day_number: day.dayNumber,
      day_title: day.dayTitle,
      guide_code: GUIDE_1_CODE,
      page_start: day.pageStart,
      page_end: day.pageEnd,
      part_code: "JE_REACTIVE",
      part_label: labelForPart("JE_REACTIVE"),
      level_code: NOT_DEFINED_IN_GUIDE,
      level_label: NOT_DEFINED_IN_GUIDE,
      exercise_start: day.reactivationRange[0],
      exercise_end: day.reactivationRange[1],
      mini_test_ref: miniTestRefForDay(day),
      correction_ref: NOT_DEFINED_IN_GUIDE,
      is_minimum_required: true,
    },
    {
      topic_id: topicId,
      day_number: day.dayNumber,
      day_title: day.dayTitle,
      guide_code: GUIDE_1_CODE,
      page_start: day.pageStart,
      page_end: day.pageEnd,
      part_code: "JE_REPRENDS_L_ESSENTIEL",
      part_label: labelForPart("JE_REPRENDS_L_ESSENTIEL"),
      level_code: NOT_DEFINED_IN_GUIDE,
      level_label: NOT_DEFINED_IN_GUIDE,
      exercise_start: NOT_DEFINED_IN_GUIDE,
      exercise_end: NOT_DEFINED_IN_GUIDE,
      mini_test_ref: miniTestRefForDay(day),
      correction_ref: NOT_DEFINED_IN_GUIDE,
      is_minimum_required: true,
    },
    ...(["NIVEAU_1", "NIVEAU_2", "NIVEAU_3", "NIVEAU_4"] as const).map((levelCode) => ({
      topic_id: topicId,
      day_number: day.dayNumber,
      day_title: day.dayTitle,
      guide_code: GUIDE_1_CODE,
      page_start: day.pageStart,
      page_end: day.pageEnd,
      part_code: "JE_MONTE_AU_NIVEAU_FIN_DE_4E" as const,
      part_label: labelForPart("JE_MONTE_AU_NIVEAU_FIN_DE_4E"),
      level_code: levelCode,
      level_label: labelForLevel(levelCode),
      exercise_start: day.levelRanges[levelCode][0],
      exercise_end: day.levelRanges[levelCode][1],
      mini_test_ref: miniTestRefForDay(day),
      correction_ref: NOT_DEFINED_IN_GUIDE,
      is_minimum_required: levelCode === "NIVEAU_1" || levelCode === "NIVEAU_2",
    })),
    {
      topic_id: topicId,
      day_number: day.dayNumber,
      day_title: day.dayTitle,
      guide_code: GUIDE_1_CODE,
      page_start: day.pageStart,
      page_end: day.pageEnd,
      part_code: "MINI_TEST",
      part_label: labelForPart("MINI_TEST"),
      level_code: NOT_DEFINED_IN_GUIDE,
      level_label: NOT_DEFINED_IN_GUIDE,
      exercise_start: day.miniTestRange[0],
      exercise_end: day.miniTestRange[1],
      mini_test_ref: miniTestRefForDay(day),
      correction_ref: NOT_DEFINED_IN_GUIDE,
      is_minimum_required: false,
    },
  ];
}

export const diagnosticReferential: DiagnosticReference[] = diagnosticDefinitions.map(([diagnosticRefId, questionOrder, questionLabel, topicId, dayNumber, defaultPart, defaultLevel, notes]) => {
  const day = dayBlueprints.find((item) => item.dayNumber === dayNumber);
  if (!day) throw new Error(`Missing day blueprint for diagnostic reference ${diagnosticRefId}`);
  return {
    diagnostic_ref_id: diagnosticRefId,
    question_order: questionOrder,
    question_label: questionLabel,
    topic_id: topicId,
    day_number: dayNumber,
    guide_code: GUIDE_1_CODE,
    guide_title: GUIDE_1_TITLE,
    page_start: day.pageStart,
    page_end: day.pageEnd,
    day_title: day.dayTitle,
    default_part: defaultPart,
    default_level: defaultLevel,
    weight: NOT_DEFINED_IN_GUIDE,
    max_score: NOT_DEFINED_IN_GUIDE,
    partial_scoring_rules: NOT_DEFINED_IN_GUIDE,
    follow_up_group_id: NOT_DEFINED_IN_GUIDE,
    notes,
  };
});

export const revisionTargets: RevisionTarget[] = dayBlueprints.flatMap((day) => day.topics.flatMap((topicId) => buildRevisionTargetsForDay(day, topicId)));

export const guideDayReferences = dayBlueprints.map((day) => ({
  dayNumber: day.dayNumber,
  dayTitle: day.dayTitle,
  guideCode: GUIDE_1_CODE,
  guideTitle: GUIDE_1_TITLE,
  pageStart: day.pageStart,
  pageEnd: day.pageEnd,
  topicSlugs: day.topics,
}));

export const bridgeFinalTestReference = {
  dayNumber: 14,
  dayTitle: "Test Passerelle vers la 3e",
  guideCode: GUIDE_1_CODE,
  guideTitle: GUIDE_1_TITLE,
  pageStart: 30,
  pageEnd: 31,
};

export const diagnosticTopicOrder = diagnosticReferential
  .map((item) => item.topic_id)
  .filter((value, index, array) => array.indexOf(value) === index);

export function getDiagnosticReferenceById(referenceId: string) {
  return diagnosticReferential.find((item) => item.diagnostic_ref_id === referenceId) ?? null;
}

export function getRevisionTargetsByTopic(topicSlug: string) {
  return revisionTargets.filter((item) => item.topic_id === topicSlug);
}

const depthSequences: Record<ControlledDepth, Array<{ partCode: GuidePartCode; levelCode: GuideLevelCode }>> = {
  FOUNDATIONS: [
    { partCode: "JE_REACTIVE", levelCode: NOT_DEFINED_IN_GUIDE },
    { partCode: "JE_REPRENDS_L_ESSENTIEL", levelCode: NOT_DEFINED_IN_GUIDE },
    { partCode: "JE_MONTE_AU_NIVEAU_FIN_DE_4E", levelCode: "NIVEAU_1" },
  ],
  CONSOLIDATION: [
    { partCode: "JE_MONTE_AU_NIVEAU_FIN_DE_4E", levelCode: "NIVEAU_1" },
    { partCode: "JE_MONTE_AU_NIVEAU_FIN_DE_4E", levelCode: "NIVEAU_2" },
    { partCode: "MINI_TEST", levelCode: NOT_DEFINED_IN_GUIDE },
  ],
  VALIDATION: [
    { partCode: "JE_MONTE_AU_NIVEAU_FIN_DE_4E", levelCode: "NIVEAU_3" },
    { partCode: "MINI_TEST", levelCode: NOT_DEFINED_IN_GUIDE },
    { partCode: "JE_MONTE_AU_NIVEAU_FIN_DE_4E", levelCode: "NIVEAU_4" },
  ],
};

export function getGuideRecommendation(topicSlug: string, depth: ControlledDepth): GuideRecommendation | null {
  const targets = getRevisionTargetsByTopic(topicSlug);
  if (targets.length === 0) return null;
  const sequence = depthSequences[depth]
    .map((step) => targets.find((target) => target.part_code === step.partCode && target.level_code === step.levelCode))
    .filter((target): target is RevisionTarget => target != null);
  const primary = sequence[0] ?? targets[0];
  return {
    topicSlug,
    depth,
    dayNumber: primary.day_number,
    dayTitle: primary.day_title,
    guideCode: primary.guide_code,
    guideTitle: GUIDE_1_TITLE,
    pageStart: primary.page_start,
    pageEnd: primary.page_end,
    primaryPartCode: primary.part_code,
    primaryPartLabel: primary.part_label,
    primaryLevelCode: primary.level_code,
    primaryLevelLabel: primary.level_label,
    sequence,
    miniTestRef: sequence.find((target) => target.part_code === "MINI_TEST")?.mini_test_ref ?? miniTestRefForDay(dayBlueprints.find((day) => day.dayNumber === primary.day_number)!),
  };
}
