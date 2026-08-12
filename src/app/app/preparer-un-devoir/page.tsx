import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { listStudentsForParent, listStudyPlans } from "@/lib/app-data";

export default async function PreparerDevoirPage() {
  const user = await requireUser();
  if (user.role !== "parent") redirect("/admin");
  const student = (await listStudentsForParent(user.id))[0];
  if (!student) redirect("/app");
  const plans = await listStudyPlans(student.id);

  return (
    <AppShell title="Préparer un devoir">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="card">
          <h2 className="text-2xl font-bold text-slate-950">Créer un programme</h2>
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
            <button className="btn-primary">Générer un programme</button>
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
