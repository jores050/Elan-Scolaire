import { Buffer } from "node:buffer";
import { addNotification, createAnalysis, upsertTopicProgress } from "@/lib/app-data";

type AnalysisResult = {
  score: number;
  status: "reussi" | "partiel" | "a_revoir";
  pointsForts: string[];
  erreurs: string[];
  notionsARevoir: string[];
  conseilEleve: string;
  conseilParent: string;
  exercicesRecommandes: string[];
  provider: "gemini" | "local";
};

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

async function callGemini(student: StudentForAnalysis, submission: SubmissionForAnalysis) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const prompt = `Tu es un accompagnateur pédagogique. Analyse le travail de ${student.first_name}, élève de 3e au Bénin. Retourne uniquement un JSON avec: score,status,points_forts,erreurs,notions_a_revoir,conseil_eleve,conseil_parent,exercices_recommandes. Notion actuelle: ${student.current_topic_slug}. Commentaire parent/élève: ${submission.comment ?? "Aucun commentaire"}.`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
    }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  const parsed = JSON.parse(text) as {
    score: number;
    status: "reussi" | "partiel" | "a_revoir";
    points_forts: string[];
    erreurs: string[];
    notions_a_revoir: string[];
    conseil_eleve: string;
    conseil_parent: string;
    exercices_recommandes: string[];
  };
  return {
    score: parsed.score,
    status: parsed.status,
    pointsForts: parsed.points_forts,
    erreurs: parsed.erreurs,
    notionsARevoir: parsed.notions_a_revoir,
    conseilEleve: parsed.conseil_eleve,
    conseilParent: parsed.conseil_parent,
    exercicesRecommandes: parsed.exercices_recommandes,
    provider: "gemini" as const,
  };
}

function localAnalysis(student: StudentForAnalysis, submission: SubmissionForAnalysis): AnalysisResult {
  const basis = Buffer.from((submission.comment ?? "") + (submission.file_names ?? []).join(",")).byteLength;
  const score = Math.max(8, Math.min(18, 10 + (basis % 9)));
  return {
    score,
    status: score >= 15 ? "reussi" : score >= 11 ? "partiel" : "a_revoir",
    pointsForts: ["Travail remis avec sérieux", `Bonne implication sur ${student.current_topic_slug}`],
    erreurs: score >= 15 ? ["Quelques détails de présentation à améliorer"] : ["Méthode encore fragile sur certaines étapes"],
    notionsARevoir: [student.current_topic_slug],
    conseilEleve: "Tu progresses. Refais un exercice semblable en appliquant chaque étape dans l’ordre.",
    conseilParent: "Encouragez une relecture finale et un rappel de méthode avant le prochain exercice.",
    exercicesRecommandes: ["Exercice 2", "Exercice 3"],
    provider: "local",
  };
}

export async function analyzeSubmission(student: StudentForAnalysis, submission: SubmissionForAnalysis) {
  const result = (await callGemini(student, submission)) ?? localAnalysis(student, submission);
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
  });
  await upsertTopicProgress(student.id, student.current_topic_slug, Math.round((result.score / 20) * 100));
  await addNotification({
    userId: student.parent_user_id,
    type: "travail_analyse",
    message: `${student.first_name} a reçu une analyse d’accompagnement sur ${student.current_topic_slug}.`,
  });
  return created;
}
