import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://elan-scolaire.vercel.app"),
  title: "Réussir les Maths 3e | Guide PDF + application Elan Scolaire",
  description: "Réussir les Maths 3e : guide PDF téléchargeable, application de suivi parental, analyse des copies, 14 jours de révision et 35 épreuves réelles.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Réussir les Maths 3e | Guide PDF + application",
    description: "Un guide PDF téléchargeable avec application, suivi parental, analyse des copies et préparation progressive au BEPC.",
    url: "/",
    siteName: "Elan Scolaire",
    locale: "fr_BJ",
    type: "website",
    images: [{ url: "/images/pret-pour-la-3e-cover.webp", width: 800, height: 1131, alt: "Couverture du guide Réussir les Maths 3e" }],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Elan Scolaire",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
