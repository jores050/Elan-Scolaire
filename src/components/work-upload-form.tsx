"use client";

import { useState } from "react";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const TOO_LARGE_MESSAGE = "Veuillez choisir un fichier plus petit : 4 MB maximum.";

export function WorkUploadForm({
  studentId,
  submissionKind,
  programDayId,
  programItemId,
  annualWeekId,
  annualWeekItemId,
  practiceTopicSlug,
  practiceGuideReference,
  practicePageReference,
  practiceExerciseReference,
  practiceContextTitle,
  serverError,
  title = "Photos ou document",
  commentPlaceholder = "Indique l’exercice et la difficulté rencontrée.",
  submitLabel = "Envoyer pour analyse",
}: {
  studentId: string;
  submissionKind?: "practice" | "diagnostic";
  programDayId?: string;
  programItemId?: string;
  annualWeekId?: string;
  annualWeekItemId?: string;
  practiceTopicSlug?: string;
  practiceGuideReference?: string;
  practicePageReference?: string;
  practiceExerciseReference?: string;
  practiceContextTitle?: string;
  serverError?: string;
  title?: string;
  commentPlaceholder?: string;
  submitLabel?: string;
}) {
  const [error, setError] = useState(serverError ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateFiles(files: FileList | null) {
    const selected = Array.from(files ?? []);
    const tooLarge = selected.find((file) => file.size > MAX_FILE_SIZE);
    if (tooLarge) {
      setError(TOO_LARGE_MESSAGE);
      return false;
    }
    setError("");
    return true;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const input = form.elements.namedItem("files") as HTMLInputElement | null;
    if (!validateFiles(input?.files ?? null)) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/app/submit-work", {
        method: "POST",
        body: new FormData(form),
        headers: {
          "x-elan-ajax": "1",
        },
      });

      const payload = await response.json().catch(() => null) as { error?: string; redirectTo?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? "L’envoi n’a pas pu être terminé. Réessayez.");
        return;
      }

      if (payload?.redirectTo) {
        window.location.assign(payload.redirectTo);
        return;
      }

      setError("L’envoi est terminé, mais la redirection automatique a échoué.");
    } catch {
      setError("L’envoi n’a pas pu être terminé. Vérifiez votre connexion puis réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      action="/api/app/submit-work"
      method="post"
      encType="multipart/form-data"
      className="mt-6 space-y-4"
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="submissionKind" value={submissionKind ?? "practice"} />
      <input type="hidden" name="programDayId" value={programDayId ?? ""} />
      <input type="hidden" name="programItemId" value={programItemId ?? ""} />
      <input type="hidden" name="annualWeekId" value={annualWeekId ?? ""} />
      <input type="hidden" name="annualWeekItemId" value={annualWeekItemId ?? ""} />
      <input type="hidden" name="practiceTopicSlug" value={practiceTopicSlug ?? ""} />
      <input type="hidden" name="practiceGuideReference" value={practiceGuideReference ?? ""} />
      <input type="hidden" name="practicePageReference" value={practicePageReference ?? ""} />
      <input type="hidden" name="practiceExerciseReference" value={practiceExerciseReference ?? ""} />
      <input type="hidden" name="practiceContextTitle" value={practiceContextTitle ?? ""} />
      <div>
        <label className="label" htmlFor="files">{title}</label>
        <input
          id="files"
          name="files"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="input"
          required
          onChange={(event) => validateFiles(event.currentTarget.files)}
        />
        {error ? <p className="mt-2 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      </div>
      <div>
        <label className="label" htmlFor="comment">Commentaire</label>
        <textarea id="comment" name="comment" className="input min-h-28" placeholder={commentPlaceholder} />
      </div>
      <button className="btn-primary disabled:cursor-not-allowed disabled:opacity-70" disabled={isSubmitting}>
        {isSubmitting ? "Envoi en cours..." : submitLabel}
      </button>
    </form>
  );
}
