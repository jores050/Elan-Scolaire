import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elan Scolaire — Suivi Maths 3e Bénin",
  description: "Aidez votre enfant à travailler régulièrement, suivre ses progrès et préparer ses devoirs de mathématiques en classe de 3e.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
