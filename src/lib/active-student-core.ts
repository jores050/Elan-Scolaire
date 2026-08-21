export type ParentStudentLike = {
  id: string;
};

export function resolveActiveStudent<T extends ParentStudentLike>(students: T[], preferredStudentId: string | null | undefined) {
  if (students.length === 0) return null;
  if (preferredStudentId) {
    const matching = students.find((student) => student.id === preferredStudentId);
    if (matching) return matching;
  }
  return students[0] ?? null;
}
