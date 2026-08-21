"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const pages = [
  { src: "/images/guide-preview/pedagogy-01.jpg", label: "Le parcours de révision en 14 jours", kind: "Parcours" },
  { src: "/images/guide-preview/pedagogy-04.jpg", label: "Suivre un raisonnement ligne après ligne", kind: "Exemple" },
  { src: "/images/guide-preview/pedagogy-06.jpg", label: "Comprendre le sens d'une racine carrée", kind: "Cours 3e" },
  { src: "/images/guide-preview/pedagogy-08.jpg", label: "Des exercices progressifs jusqu'au défi", kind: "Exercices" },
  { src: "/images/guide-preview/pedagogy-09.jpg", label: "Une correction qui explique le raisonnement", kind: "Corrigé" },
  { src: "/images/guide-preview/pedagogy-11.jpg", label: "Le lien entre le guide et le suivi parental", kind: "Application" },
  { src: "/images/guide-preview/preview-009.jpg", label: "Une épreuve réelle de mathématiques", kind: "Épreuve" },
  { src: "/images/guide-preview/bepc-2026-106.jpg", label: "Un BEPC blanc départemental 2026", kind: "BEPC" },
] as const;

export function GuidePreview() {
  const [page, setPage] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const current = pages[page];

  function move(direction: number) {
    setPage((value) => (value + direction + pages.length) % pages.length);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
      if (event.key === "Escape") setZoomed(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleTouchEnd(clientX: number) {
    if (touchStart == null) return;
    const distance = touchStart - clientX;
    if (Math.abs(distance) > 40) move(distance > 0 ? 1 : -1);
    setTouchStart(null);
  }

  const image = (
    <Image
      src={current.src}
      alt={`${current.label}, aperçu du contenu inclus dans le pack`}
      width={1075}
      height={1519}
      sizes={zoomed ? "96vw" : "(max-width: 768px) 88vw, 560px"}
      className={zoomed ? "max-h-[86vh] w-auto rounded-2xl object-contain" : "guide-preview-page"}
    />
  );

  return (
    <div className="guide-preview">
      <button
        type="button"
        className="guide-preview-stage text-left"
        onClick={() => setZoomed(true)}
        onTouchStart={(event) => setTouchStart(event.changedTouches[0]?.clientX ?? null)}
        onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
        aria-label="Agrandir l’aperçu"
      >
        {image}
        <span className="guide-preview-badge">{current.kind}</span>
      </button>
      <div className="guide-preview-controls">
        <button type="button" onClick={() => move(-1)} aria-label="Page précédente">←</button>
        <div>
          <p className="font-black text-slate-950">{current.label}</p>
          <p className="text-sm text-slate-500">Page {page + 1} sur {pages.length} · touchez pour agrandir</p>
        </div>
        <button type="button" onClick={() => move(1)} aria-label="Page suivante">→</button>
      </div>
      <div className="guide-preview-dots" aria-label="Choisir une page">
        {pages.map((item, index) => (
          <button
            key={item.src}
            type="button"
            onClick={() => setPage(index)}
            aria-label={`Afficher la page ${index + 1}`}
            aria-current={page === index ? "true" : undefined}
          />
        ))}
      </div>
      {zoomed ? (
        <div className="fixed inset-0 z-[80] bg-slate-950/90 p-4" role="dialog" aria-modal="true" aria-label="Aperçu agrandi du guide">
          <div className="mx-auto flex h-full max-w-5xl flex-col items-center justify-center gap-4">
            <div className="flex w-full items-center justify-between gap-3 text-white">
              <button type="button" onClick={() => move(-1)} className="rounded-full bg-white/10 px-4 py-2 font-black">←</button>
              <p className="text-center text-sm font-bold">{current.label}</p>
              <button type="button" onClick={() => move(1)} className="rounded-full bg-white/10 px-4 py-2 font-black">→</button>
            </div>
            <div
              onTouchStart={(event) => setTouchStart(event.changedTouches[0]?.clientX ?? null)}
              onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
            >
              {image}
            </div>
            <button type="button" onClick={() => setZoomed(false)} className="rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950">Fermer l’aperçu</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
