import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getStudentSelectionForParent } from "@/lib/active-student";
import { requireParentAccess } from "@/lib/auth";
import { listStudyPlans } from "@/lib/app-data";

export default async function PreparerDevoirPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireParentAccess({ requireStudent: true });
  if (user.role !== "parent") redirect("/admin");
  const { activeStudent: student } = await getStudentSelectionForParent(user.id);
  if (!student) redirect("/app");
  const plans = await listStudyPlans(student.id);
  const params = await searchParams;
  const noContent = params.error === "no-content";

  return (
    <AppShell title="Préparer un devoir">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="card">
          <h2 className="text-2xl font-bold text-slate-950">Préparer un devoir</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Le plan est temporaire, prioritaire jusqu’au devoir, puis ÉLAN revient automatiquement au parcours annuel normal.</p>
          {noContent ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-slate-700">Aucun exercice validé n’est encore disponible pour cette notion. Aucun faux exercice n’a été généré.</p> : null}
          <form action="/api/app/study-plan" method="post" className="mt-6 space-y-4">
            <input type="hidden" name="studentId" value={student.id} />
            <div>
              <label className="label" htmlFor="examDate">Quand est ton devoir ?</label>
              <input id="examDate" name="examDate" type="date" className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="topicSlug">Jusqu’où avez-vous étudié ?</label>
              <input id="topicSlug" name="topicSlug" className="input" defaultValue={student.current_topic_slug} />
            </div>
            <div>
              <label className="label" htmlFor="duration">Combien de temps peux-tu travailler ?</label>
              <select id="duration" name="duration" className="input">
                <option>20 min</option>
                <option>30 min</option>
                <option>45 min</option>
                <option>1 h</option>
              </select>
            </div>
            <button className="btn-primary">Créer le plan Aujourd’hui · Demain · Veille</button>
          </form>
        </div>
        <div className="card">
          <h2 className="text-2xl font-bold text-slate-950">Plans enregistrés</h2>
          <div className="mt-6 space-y-4">
            {plans.length === 0 ? (
              <p className="text-sm text-slate-600">Aucun plan pour le moment.</p>
            ) : (
              plans.map((plan) => (
                <div key={plan.id} className="rounded-3xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-950">Devoir du {plan.exam_date}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {(plan.study_plan_items ?? []).map((item: { day_label: string; topic: string; exercises: string }) => (
                      <div key={`${plan.id}-${item.day_label}`} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                        <p className="font-semibold">{item.day_label}</p>
                        <p>{item.topic}</p>
                        <p>{item.exercises}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
