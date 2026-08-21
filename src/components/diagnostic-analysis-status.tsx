"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ValidationStatus = "MATCH" | "PARTIAL_MATCH" | "MISMATCH" | "UNREADABLE";
type ProcessingStatus = "pending" | "processing" | "completed" | "failed";
type StepState = "done" | "blocked" | "current" | "todo";

type DiagnosticStatusPayload = {
  ok: boolean;
  processingStatus?: ProcessingStatus;
  processingError?: string | null;
  validationStatus?: ValidationStatus | null;
  validationConfidence?: "high" | "medium" | "low" | null;
  validationReason?: string | null;
  validationConfirmedAt?: string | null;
  redirectTo?: string | null;
  error?: string;
};

const POLL_INTERVAL_MS = 5000;

function getStepStates(status: ProcessingStatus, validationStatus: ValidationStatus | null): Array<{ label: string; state: StepState }> {
  const photosReceived = true;
  const copyValidated = validationStatus === "MATCH" || validationStatus === "PARTIAL_MATCH";
  const answersAnalysed = status === "processing" || status === "completed";
  const planPrepared = status === "completed";

  return [
    {
      label: "Photos reçues",
      state: photosReceived ? "done" : "current",
    },
    {
      label: "Vérification de la copie",
      state:
        validationStatus === "MISMATCH" || validationStatus === "UNREADABLE"
          ? "blocked"
          : copyValidated
            ? "done"
            : "current",
    },
    {
      label: "Analyse des réponses",
      state:
        validationStatus === "MISMATCH" || validationStatus === "UNREADABLE"
          ? "blocked"
          : answersAnalysed
            ? status === "completed"
              ? "done"
              : "current"
            : "todo",
    },
    {
      label: "Préparation du programme personnalisé",
      state:
        validationStatus === "MISMATCH" || validationStatus === "UNREADABLE"
          ? "blocked"
          : planPrepared
            ? "done"
            : answersAnalysed
              ? "current"
              : "todo",
    },
  ];
}

function StepIndicator({ state }: { state: StepState }) {
  if (state === "done") {
    return <span aria-hidden="true">✓</span>;
  }

  if (state === "blocked") {
    return <span aria-hidden="true">!</span>;
  }

  if (state === "current") {
    return (
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-[-0.125rem]"
      />
    );
  }

  return <span aria-hidden="true">•</span>;
}

export function DiagnosticAnalysisStatus({
  submissionId,
  initialStatus,
  initialValidationStatus,
  initialValidationConfidence,
  initialValidationReason,
  initialValidationConfirmedAt,
}: {
  submissionId: string;
  initialStatus: ProcessingStatus;
  initialValidationStatus: ValidationStatus | null;
  initialValidationConfidence: "high" | "medium" | "low" | null;
  initialValidationReason: string | null;
  initialValidationConfirmedAt: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus | null>(initialValidationStatus);
  const [validationConfidence, setValidationConfidence] = useState<"high" | "medium" | "low" | null>(initialValidationConfidence);
  const [validationReason, setValidationReason] = useState(initialValidationReason ?? "");
  const [validationConfirmedAt, setValidationConfirmedAt] = useState(initialValidationConfirmedAt);
  const [error, setError] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const pollStatus = useEffectEvent(async () => {
    const response = await fetch(`/api/app/diagnostic/${submissionId}/status`, {
      cache: "no-store",
    });
    const payload = await response.json() as DiagnosticStatusPayload;
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Impossible de récupérer l'état du diagnostic.");
      return;
    }

    if (payload.processingStatus) {
      setStatus(payload.processingStatus);
    }
    setValidationStatus(payload.validationStatus ?? null);
    setValidationConfidence(payload.validationConfidence ?? null);
    setValidationReason(payload.validationReason ?? "");
    setValidationConfirmedAt(payload.validationConfirmedAt ?? null);
    if (payload.processingError) {
      setError(payload.processingError);
    } else {
      setError("");
    }
    if (payload.processingStatus === "completed" && payload.redirectTo) {
      router.replace(payload.redirectTo);
    }
  });

  useEffect(() => {
    if (status === "completed") return;
    const immediateTimer = window.setTimeout(() => {
      void pollStatus();
    }, 0);
    const timer = window.setInterval(() => {
      void pollStatus();
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(immediateTimer);
      window.clearInterval(timer);
    };
  }, [status]);

  async function handleRetry() {
    setIsRetrying(true);
    setError("");
    try {
      const response = await fetch(`/api/app/diagnostic/${submissionId}/retry`, {
        method: "POST",
        headers: {
          "x-elan-ajax": "1",
        },
      });
      const payload = await response.json() as DiagnosticStatusPayload;
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "La relance a échoué.");
        return;
      }
      if (payload.redirectTo) {
        router.replace(payload.redirectTo);
        return;
      }
      setStatus("pending");
      setValidationStatus(null);
      setValidationConfidence(null);
      setValidationReason("");
      setValidationConfirmedAt(null);
    } finally {
      setIsRetrying(false);
    }
  }

  async function handleConfirm() {
    setIsConfirming(true);
    setError("");
    try {
      const response = await fetch(`/api/app/submissions/${submissionId}/confirm-match`, {
        method: "POST",
        headers: {
          "x-elan-ajax": "1",
        },
      });
      const payload = await response.json() as DiagnosticStatusPayload;
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "La confirmation a échoué.");
        return;
      }
      setValidationConfirmedAt(new Date().toISOString());
      setStatus("pending");
      if (payload.redirectTo) {
        router.replace(payload.redirectTo);
      }
    } finally {
      setIsConfirming(false);
    }
  }

  const statusLabel = status === "pending"
    ? validationStatus === null
      ? "Validation de la copie en attente"
      : "Analyse en file d'attente"
    : status === "processing"
      ? validationStatus && validationStatus !== "PARTIAL_MATCH"
        ? "Analyse pédagogique en cours"
        : "Vérification de la copie en cours"
      : status === "failed"
        ? validationStatus === "PARTIAL_MATCH"
          ? "Confirmation parentale requise"
          : validationStatus === "MISMATCH"
            ? "Mauvaise copie détectée"
            : validationStatus === "UNREADABLE"
              ? "Copie illisible"
              : "Traitement interrompu"
        : "Analyse terminée";

  const canConfirm = status === "failed" && validationStatus === "PARTIAL_MATCH" && !validationConfirmedAt;
  const canRetry = status === "failed" && !canConfirm;
  const steps = getStepStates(status, validationStatus);

  return (
    <div className="space-y-6">
      <section className="card">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Diagnostic initial</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-950">{statusLabel}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {steps.map((step) => (
            <div
              key={step.label}
              className={`rounded-2xl border p-4 text-sm ${
                step.state === "done"
                  ? "border-green-200 bg-green-50 text-green-900"
                  : step.state === "blocked"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : step.state === "current"
                      ? "border-blue-200 bg-blue-50 text-blue-900"
                      : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <p className="flex items-center gap-2 font-semibold">
                <StepIndicator state={step.state} />
                <span>{step.label}</span>
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
          {status === "pending" && validationStatus === null ? <p>Les fichiers ont bien été reçus. ÉLAN vérifie d’abord qu’il s’agit bien de la copie du diagnostic avant toute analyse pédagogique.</p> : null}
          {status === "processing" ? <p>ÉLAN vérifie la cohérence de la copie, structure les résultats par notion puis prépare le programme personnalisé.</p> : null}
          {status === "failed" && validationStatus === "PARTIAL_MATCH" ? <p>La copie semble correspondre en partie au diagnostic, mais la preuve reste incomplète. Si c’est bien la bonne copie, vous pouvez confirmer pour lancer l’analyse.</p> : null}
          {status === "failed" && validationStatus === "MISMATCH" ? <p>Cette copie ne semble pas correspondre au travail demandé. Renvoyez la bonne copie du diagnostic initial.</p> : null}
          {status === "failed" && validationStatus === "UNREADABLE" ? <p>La photo est difficile à lire. Reprenez-la avec toute la feuille visible, une bonne lumière et une image nette.</p> : null}
          {status === "failed" && validationStatus === null ? <p>La vérification automatique n’a pas pu aboutir. Vous pouvez relancer le traitement sans renvoyer les fichiers.</p> : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          {validationStatus ? (
            <div className="inline-flex rounded-full bg-blue-50 px-4 py-2 font-semibold text-blue-800">
              Validation : {validationStatus}{validationConfidence ? ` (${validationConfidence})` : ""}
            </div>
          ) : null}
        </div>
        {validationReason ? <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">{validationReason}</p> : null}
        {error ? <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
        {canConfirm ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn-primary disabled:cursor-not-allowed disabled:opacity-70" onClick={handleConfirm} disabled={isConfirming}>
              {isConfirming ? "Confirmation..." : "Confirmer et lancer l’analyse"}
            </button>
            <a href="/app/diagnostic" className="btn-secondary">Envoyer une autre photo</a>
          </div>
        ) : null}
        {canRetry ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn-primary disabled:cursor-not-allowed disabled:opacity-70" onClick={handleRetry} disabled={isRetrying}>
              {isRetrying ? "Relance..." : "Réessayer"}
            </button>
            <a href="/app/diagnostic" className="btn-secondary">Envoyer une autre photo</a>
          </div>
        ) : null}
      </section>
    </div>
  );
}
