export type AnnualProgressStatus = "not_started" | "in_progress" | "completed" | "needs_review";

export function shouldTransitionToAnnual(completedDays: number, totalDays: number, enrolled: boolean) {
  return totalDays > 0 && completedDays >= totalDays && !enrolled;
}

export function computeWeekStatus(statuses: AnnualProgressStatus[]): AnnualProgressStatus {
  if (statuses.length === 0) return "not_started";
  if (statuses.some((status) => status === "needs_review")) return "needs_review";
  if (statuses.every((status) => status === "completed")) return "completed";
  if (statuses.some((status) => status !== "not_started")) return "in_progress";
  return "not_started";
}
