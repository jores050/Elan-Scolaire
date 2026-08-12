import { getExercisesByTopic, getLatestAnalysisForStudent, getProgressForStudent } from "@/lib/db";
import { topicLabels } from "@/lib/topics";
import type { StudentRecord } from "@/lib/types";

export function getRecommendation(student: StudentRecord) {
  const progress = getProgressForStudent(student.id);
  const current = progress.find((item) => item.topicSlug === student.currentTopicSlug);
  const weak = [...progress].sort((a, b) => a.score - b.score)[0];
  const focusTopic = weak && weak.score < 50 ? weak.topicSlug : student.currentTopicSlug;
  const exercises = getExercisesByTopic(focusTopic);
  const analysis = getLatestAnalysisForStudent(student.id);
  const score = current?.score ?? 42;
  const band = score < 50 ? "facile" : score < 70 ? "consolidation" : score < 85 ? "intermédiaire" : "défi";
  return {
    topicSlug: focusTopic,
    topicLabel: topicLabels[focusTopic] ?? "Notion",
    score,
    band,
    estimatedMinutes: student.targetMinutes,
    exercises,
    lastAdvice: analysis?.conseilEleve ?? "Continue avec régularité. Une courte séance bien faite vaut mieux qu’une longue séance abandonnée.",
  };
}

export function getProgressSummary(studentId: string) {
  const progress = getProgressForStudent(studentId);
  const total = progress.length || 1;
  const percentage = Math.round(progress.reduce((sum, item) => sum + item.score, 0) / total);
  const mastered = progress.filter((item) => item.mastery === "maitrise").map((item) => topicLabels[item.topicSlug]);
  const weak = progress.filter((item) => item.mastery === "a_renforcer").map((item) => topicLabels[item.topicSlug]);
  return { percentage, mastered, weak, progress };
}
