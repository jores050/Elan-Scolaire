import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { listStudentsForParent } from "@/lib/app-data";
import { requireUser } from "@/lib/auth";
import { getPretProgramState } from "@/lib/pret-program";

export default async function EnvoyerTravailPage() {
  const user = await requireUser();
  if (user.role !== "parent") redirect("/admin");
  const student = (await listStudentsForParent(user.id))[0];
  if (!student) redirect("/app");
  const program = await getPretProgramState(student.id);
  const day = program.currentDay;
  const firstExercise = day?.items.find((item) => item.item_type === "exercise") ?? null;

  return (
    <AppShell title="Envoyer un travail">
      <div className="mx-auto max-w-2xl card">
        <h2 className="text-2xl font-bold text-slate-950">Envoyer mon travail</h2>
        <p className="mt-2 text-sm text-slate-600">Formats acceptés : jpg, jpeg, png, webp, pdf. Les fichiers restent privés.</p>
        {day ? (
          <p className="mt-3 text-sm text-slate-700">
            Travail lié au Jour {day.day_number} · {day.title}
          </p>
        ) : null}
        <form action="/api/app/submit-work" method="post" encType="multipart/form-data" className="mt-6 space-y-4">
          <input type="hidden" name="studentId" value={student.id} />
          <input type="hidden" name="programDayId" value={day?.id ?? ""} />
          <input type="hidden" name="programItemId" value={firstExercise?.id ?? ""} />
          <div>
            <label className="label" htmlFor="files">Photos ou document</label>
            <input id="files" name="files" type="file" multiple className="input" />
          </div>
          <div>
            <label className="label" htmlFor="comment">Commentaire</label>
            <textarea id="comment" name="comment" className="input min-h-28" placeholder="Exemple : exercice 3 difficile, doute sur la méthode..." />
          </div>
          <button className="btn-primary">Envoyer pour analyse</button>
        </form>
      </div>
    </AppShell>
  );
}
