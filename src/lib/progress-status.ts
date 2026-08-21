export const progressStatusLabels: Record<string, string> = {
  not_started: "À commencer",
  in_progress: "En cours",
  completed: "Terminé",
  needs_review: "À revoir",
};

export function getProgressStatusLabel(status: string) {
  return progressStatusLabels[status] ?? status;
}
