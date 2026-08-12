export const curriculum = [
  {
    slug: "sa1",
    name: "SA1 — Triangles",
    topics: [
      "nombres-reels",
      "valeur-absolue",
      "trigonometrie",
      "thales",
      "reciproque-thales",
      "triangles-semblables",
      "triangle-rectangle",
      "angles-cercles",
    ],
  },
  { slug: "sa2", name: "SA2 — Configurations de l’espace", topics: ["cone", "sections-planes"] },
  {
    slug: "sa3",
    name: "SA3 — Calcul littéral",
    topics: ["polynomes", "equations-droite", "equations", "inequations", "vecteurs", "coordonnees-vecteurs"],
  },
  {
    slug: "sa4",
    name: "SA4 — Organisation des données",
    topics: ["applications-affines", "applications-lineaires", "statistique"],
  },
] as const;

export const topicLabels: Record<string, string> = {
  "nombres-reels": "Nombres réels",
  "valeur-absolue": "Valeur absolue",
  trigonometrie: "Trigonométrie",
  thales: "Thalès",
  "reciproque-thales": "Réciproque de Thalès",
  "triangles-semblables": "Triangles semblables",
  "triangle-rectangle": "Triangle rectangle",
  "angles-cercles": "Angles et cercles",
  cone: "Cône",
  "sections-planes": "Sections planes",
  polynomes: "Polynômes",
  "equations-droite": "Équations de droite",
  equations: "Équations",
  inequations: "Inéquations",
  vecteurs: "Vecteurs",
  "coordonnees-vecteurs": "Coordonnées de vecteurs",
  "applications-affines": "Applications affines",
  "applications-lineaires": "Applications linéaires",
  statistique: "Statistique",
};
