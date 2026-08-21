import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { WorkUploadForm } from "@/components/work-upload-form";
import { getStudentSelectionForParent } from "@/lib/active-student";
import { getLearningJourneyState } from "@/lib/annual-program";
import { requireParentAccess } from "@/lib/auth";

const errorMessages: Record<string, string> = {
  files: "Veuillez choisir un fichier plus petit : 4 MB maximum.",
  upload: "L’envoi n’a pas pu être terminé. Réessayez avec un fichier plus léger.",
  forbidden: "Vous ne pouvez pas envoyer ce travail depuis ce compte.",
};

export default async function EnvoyerTravailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  const user = await requireParentAccess({ requireStudent: true });
  if (user.role !== "parent") redirect("/admin");
  const { activeStudent: student } = await getStudentSelectionForParent(user.id);
  if (!student) redirect("/app/ajouter-eleve");
  const journey = await getLearningJourneyState(student.id);
  const day = journey.phase === "preparation" ? journey.preparation.currentDay : null;
  const prepItem = day?.items.find((item) => item.item_type === "exercise") ?? null;
  const annualSession = journey.phase === "annual_tracking" ? journey.annual.recommendedSession : null;

  if (journey.phase === "preparation" && journey.preparation.requiresDiagnostic) {
    return (
      <AppShell title="Envoyer un travail">
        <div className="mx-auto max-w-2xl space-y-6">
          <section className="card">
            <h2 className="text-2xl font-bold text-slate-950">Diagnostic à envoyer</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>Avant toute séance personnalisée, ÉLAN attend d’abord la copie du diagnostic initial.</p>
              <p>Ouvrez le Guide 1, laissez votre enfant répondre sur papier, puis envoyez les photos depuis la page diagnostic.</p>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  if (journey.phase === "annual_tracking" && !annualSession) {
    return <AppShell title="Envoyer un travail"><div className="mx-auto max-w-2xl card"><h2 className="text-2xl font-bold">Suivi de l’année activé</h2><p className="mt-3 text-sm leading-6 text-slate-700">Vous pourrez envoyer un travail dès que la première semaine d’accompagnement de votre enfant sera disponible.</p></div></AppShell>;
  }

  return (
    <AppShell title="Envoyer un travail">
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="card">
          <h2 className="text-2xl font-bold text-slate-950">Envoyer le travail</h2>
          <p className="mt-2 text-sm text-slate-600">Formats acceptés : jpg, jpeg, png, webp, pdf. Chaque fichier doit faire 4 MB maximum.</p>
          {day ? (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">Copie attendue</p>
              <p className="mt-2">Guide : {day.guideLabel}</p>
              <p>Jour : J{day.day_number}</p>
              {day.pageReference ? <p>Pages : {day.pageReference}</p> : null}
              {day.recommendedPart !== "Guide papier" ? <p>Partie : {day.recommendedPart}</p> : null}
              {day.recommendedLevel !== "Guide papier" ? <p>Niveau : {day.recommendedLevel}</p> : null}
            </div>
          ) : null}
          {annualSession ? (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">Copie attendue</p>
              <p className="mt-2">{annualSession.topic_label}</p>
              <p>{annualSession.guide_reference ?? "Référence du guide en cours de préparation"}</p>
              <p>{annualSession.reference_label}</p>
            </div>
          ) : null}
          <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-950">Ce qu’ÉLAN fera ensuite</p>
            <p className="mt-2">1. Vérifier que la copie correspond bien au travail demandé.</p>
            <p>2. Lancer l’analyse pédagogique.</p>
            <p>3. Mettre à jour la progression et préparer la prochaine étape.</p>
          </div>
        </section>
        <section className="card">
        <WorkUploadForm
          studentId={student.id}
          programDayId={day?.id ?? ""}
          programItemId={prepItem?.id ?? ""}
          annualWeekId={annualSession?.source === "annual" ? annualSession.week_id ?? "" : ""}
          annualWeekItemId={annualSession?.source === "annual" ? annualSession.week_item_id ?? "" : ""}
          practiceTopicSlug={annualSession?.topic_slug ?? day?.topicSlugs?.[0] ?? student.current_topic_slug}
          practiceGuideReference={annualSession?.guide_reference ?? day?.guideLabel ?? ""}
          practicePageReference={annualSession?.page_reference ?? day?.pageReference ?? ""}
          practiceExerciseReference={annualSession?.exercise_reference ?? ""}
          practiceContextTitle={annualSession?.title ?? day?.title ?? ""}
          serverError={errorMessages[error]}
        />
        </section>
      </div>
    </AppShell>
  );
}
