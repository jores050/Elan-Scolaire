"use client";

import { usePathname, useSearchParams } from "next/navigation";

type StudentOption = {
  id: string;
  firstName: string;
  level: string;
};

export function StudentSwitcher({
  students,
  activeStudentId,
}: {
  students: StudentOption[];
  activeStudentId: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const redirectTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  if (students.length <= 1) return null;

  return (
    <form action="/api/app/active-student" method="post" className="flex items-center gap-3">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <label htmlFor="activeStudentId" className="text-sm font-medium text-slate-700">Élève actif</label>
      <select
        id="activeStudentId"
        name="studentId"
        defaultValue={activeStudentId ?? students[0]?.id ?? ""}
        className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.firstName} · {student.level}
          </option>
        ))}
      </select>
    </form>
  );
}
