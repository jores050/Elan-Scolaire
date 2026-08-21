import type { DiagnosticReference } from "@/lib/diagnostic-referential";

export type DiagnosticReferenceResult = {
  referenceId: string;
  topicSlug: string;
  result: "correct" | "partial" | "incorrect" | "not_visible";
  evidence: string;
    confidence: "high" | "medium" | "low";
};

export type TopicDiagnosticResult = {
  topicSlug: string;
  mastery: "maitrise" | "a_renforcer" | "a_reprendre";
  score: number;
  evidenceCount: number;
  correctCount: number;
  partialCount: number;
  incorrectCount: number;
  confidence: "high" | "medium" | "low";
  evidence: string[];
  referenceIds: string[];
  recommendedDayNumbers: number[];
};

function resultToScore(result: DiagnosticReferenceResult["result"]) {
  if (result === "correct") return 100;
  if (result === "partial") return 60;
  if (result === "incorrect") return 20;
  return null;
}

function mergeConfidence(levels: Array<DiagnosticReferenceResult["confidence"]>) {
  if (levels.every((item) => item === "high")) return "high";
  if (levels.some((item) => item === "high") || levels.some((item) => item === "medium")) return "medium";
  return "low";
}

export function evaluateDiagnosticTopicResults(
  references: DiagnosticReference[],
  results: DiagnosticReferenceResult[],
  previousScores: Map<string, number>,
) {
  const referenceMap = new Map(references.map((item) => [item.diagnostic_ref_id, item]));
  const grouped = new Map<string, DiagnosticReferenceResult[]>();

  for (const result of results) {
    const reference = referenceMap.get(result.referenceId);
    if (!reference || reference.topic_id !== result.topicSlug) continue;
    const entries = grouped.get(result.topicSlug) ?? [];
    entries.push(result);
    grouped.set(result.topicSlug, entries);
  }

  const topicResults: TopicDiagnosticResult[] = [];
  for (const [topicSlug, topicEntries] of grouped.entries()) {
    const scoredEntries = topicEntries
      .map((item) => ({ item, score: resultToScore(item.result) }))
      .filter((item): item is { item: DiagnosticReferenceResult; score: number } => item.score != null);

    if (scoredEntries.length === 0) continue;

    const rawAverage = Math.round(scoredEntries.reduce((sum, item) => sum + item.score, 0) / scoredEntries.length);
    const previousScore = previousScores.get(topicSlug);
    const finalScore = previousScore == null
      ? rawAverage
      : Math.round((rawAverage * 0.7) + (previousScore * 0.3));

    const correctCount = scoredEntries.filter((item) => item.item.result === "correct").length;
    const partialCount = scoredEntries.filter((item) => item.item.result === "partial").length;
    const incorrectCount = scoredEntries.filter((item) => item.item.result === "incorrect").length;
    const evidenceCount = scoredEntries.length;

    let mastery: TopicDiagnosticResult["mastery"] = "a_renforcer";
    if (evidenceCount >= 2) {
      if (finalScore >= 80 && incorrectCount === 0) mastery = "maitrise";
      else if (finalScore < 45 || incorrectCount >= Math.ceil(evidenceCount / 2)) mastery = "a_reprendre";
    } else if (evidenceCount === 1) {
      if (rawAverage >= 85) mastery = "maitrise";
      else if (rawAverage < 35 && previousScore != null && previousScore < 50) mastery = "a_reprendre";
    }

    const topicReferences = references.filter((item) => item.topic_id === topicSlug);
    topicResults.push({
      topicSlug,
      mastery,
      score: finalScore,
      evidenceCount,
      correctCount,
      partialCount,
      incorrectCount,
      confidence: mergeConfidence(scoredEntries.map((item) => item.item.confidence)),
      evidence: scoredEntries.map((item) => item.item.evidence),
      referenceIds: scoredEntries.map((item) => item.item.referenceId),
      recommendedDayNumbers: topicReferences.map((item) => item.day_number).filter((value, index, array) => array.indexOf(value) === index),
    });
  }

  return topicResults.sort((a, b) => a.topicSlug.localeCompare(b.topicSlug));
}
