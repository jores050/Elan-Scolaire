import Image from "next/image";
import { GuidePreview } from "@/components/guide-preview";
import { LandingDemo } from "@/components/landing-demo";
import { LaunchOffer } from "@/components/launch-offer";
import { PriceAmount, PriceLine } from "@/components/price-display";
import { PublicFooter, PublicHeader, PurchaseLink } from "@/components/shell";
import { getCurrentPrice, PRICE_CURRENCY } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const journey = [
  ["01", "Réviser la 4e", "14 jours guidés pour consolider les bases avant d’aborder la 3e."],
  ["02", "Apprendre la 3e", "Cours, exercices et épreuves accompagnent l’élève pendant l’année."],
  ["03", "Préparer le BEPC", "35 épreuves réelles pour s’entraîner progressivement."],
] as const;

const appSteps = [
  ["1", "Rappel", "L’élève sait quoi travailler."],
  ["2", "Copie", "Il envoie une photo ou un PDF de son travail."],
  ["3", "Orientation", "L’analyse repère réussites, erreurs et points à reprendre."],
] as const;

const pack = [
  "Guide PDF téléchargeable Réussir les Maths 3e",
  "Révision de 4e en 14 jours",
  "Cours et exercices pour accompagner la 3e",
  "35 épreuves réelles de 3e et du BEPC",
  "Application et suivi parental",
  "Groupe WhatsApp d’accompagnement",
] as const;

const faq = [
  ["Que contient le pack ?", "Le guide PDF téléchargeable, les 14 jours de révision, les cours et exercices de 3e, 35 épreuves réelles, l’application Elan Scolaire et le groupe WhatsApp d’accompagnement."],
  ["L’application remplace-t-elle le guide ?", "Non. L’élève travaille dans le guide et son cahier. L’application organise le travail, analyse les copies envoyées et montre les points à reprendre."],
  ["Mon enfant doit-il avoir un smartphone ?", "Non. Le téléphone du parent peut servir aux rappels, à l’envoi des copies et au suivi."],
  ["Faut-il Internet pour travailler ?", "Pas pour lire le guide et travailler dans le cahier. Une connexion est nécessaire pour activer l’espace, envoyer une copie et consulter son analyse."],
  ["L’application est-elle incluse ?", "Oui. Elle est comprise dans le paiement unique du pack."],
  ["Comment obtenir mon accès ?", "Après l’achat, vous téléchargez le guide PDF et recevez votre clé d’activation. Connectez-vous ensuite pour créer le compte parent et associer votre enfant."],
] as const;

export default function HomePage() {
  const offerDeadline = process.env.NEXT_PUBLIC_LAUNCH_OFFER_ENDS_AT ?? "";
  const currentPrice = getCurrentPrice(offerDeadline);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Réussir les Maths 3e",
    description: "Guide PDF téléchargeable avec application Elan Scolaire, suivi parental, analyse des copies et préparation progressive au BEPC.",
    image: "https://elan-scolaire.vercel.app/images/pret-pour-la-3e-cover.webp",
    brand: { "@type": "Brand", name: "Elan Scolaire" },
    offers: {
      "@type": "Offer",
      price: currentPrice,
      priceCurrency: PRICE_CURRENCY,
      availability: "https://schema.org/InStock",
      url: "https://elan-scolaire.vercel.app/",
    },
  };

  return (
    <div className="overflow-x-clip bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <LaunchOffer deadline={offerDeadline} />
      <PublicHeader />
      <main>
        <section className="landing-hero">
          <div className="shell grid items-center gap-10 py-12 md:grid-cols-[1.08fr_0.92fr] md:py-20 lg:gap-16">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700 sm:text-sm">Réussir les Maths 3e · Elan Scolaire</p>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.06] tracking-tight text-emerald-950 sm:text-5xl lg:text-6xl">Aidez votre enfant à réussir les maths en 3e, des révisions de 4e jusqu’au BEPC.</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">Guide PDF téléchargeable + accès à l’application Elan Scolaire pour reprendre les bases, travailler la 3e et suivre les progrès.</p>
              <div className="mt-7">
                <p className="text-4xl font-black text-emerald-950"><PriceAmount deadline={offerDeadline} /></p>
                <p className="mt-1 font-semibold text-slate-600">Paiement unique · PDF + application inclus</p>
              </div>
              <div className="mt-7"><PurchaseLink compact className="w-full sm:w-auto" /></div>
              <ul className="mt-7 grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-2">{["14 jours de révision", "Accompagnement toute l’année", "35 épreuves réelles", "Suivi parental"].map((item) => <li key={item} className="flex gap-2"><span className="text-emerald-600">✓</span>{item}</li>)}</ul>
            </div>
            <div className="relative flex justify-center md:justify-end"><div aria-hidden="true" className="absolute inset-1/4 rounded-full bg-yellow-300/35 blur-3xl" /><Image src="/images/pret-pour-la-3e-cover.webp" alt="Couverture du guide Réussir les Maths 3e" width={800} height={1131} sizes="(max-width: 640px) 260px, (max-width: 1024px) 340px, 420px" priority className="relative h-auto w-[250px] drop-shadow-[0_28px_30px_rgba(3,47,37,0.25)] sm:w-[320px] lg:w-[420px]" /></div>
          </div>
        </section>

        <section className="shell py-14 md:py-18"><div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"><div><p className="landing-eyebrow">Le problème</p><h2 className="landing-title">Réviser sans plan fait perdre du temps.</h2></div><div className="rounded-3xl bg-yellow-50 p-6 text-lg font-bold leading-8 text-emerald-950">Le guide transforme « Va réviser tes maths » en travail précis, dans le bon ordre.</div></div></section>

        <section className="bg-slate-50 py-16 md:py-20"><div className="shell"><p className="landing-eyebrow">Le parcours</p><h2 className="landing-title">Des bases de 4e jusqu’au BEPC.</h2><div className="mt-10 grid gap-5 lg:grid-cols-3">{journey.map(([number, title, text]) => <article key={number} className="landing-card"><span className="text-sm font-black text-emerald-700">{number}</span><h3 className="mt-4 text-2xl font-black text-emerald-950">{title}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p></article>)}</div></div></section>

        <section className="shell py-16 md:py-20"><div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center"><div><p className="landing-eyebrow">Aperçu du contenu</p><h2 className="landing-title">Découvrez le contenu de Réussir les Maths 3e.</h2><p className="landing-intro">Aperçu des 14 jours, d’un cours détaillé, d’exercices, d’une situation réelle, d’un corrigé et d’épreuves incluses dans le parcours.</p><div className="mt-6 flex flex-wrap gap-2">{["14 jours", "Cours de 3e", "Exercices", "Corrigés", "Épreuves"].map((item) => <span key={item} className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800">{item}</span>)}</div></div><GuidePreview /></div></section>

        <section className="bg-blue-950 py-16 text-white md:py-20"><div className="shell"><p className="landing-eyebrow-on-dark">Le guide + l’application</p><h2 className="landing-title-on-dark">Il travaille. L’application l’oriente.</h2><div className="mt-10 grid gap-4 md:grid-cols-3">{appSteps.map(([number, title, text]) => <article key={number} className="rounded-3xl border border-white/15 bg-white/10 p-6"><p className="text-3xl font-black text-yellow-300">0{number}</p><h3 className="mt-4 text-xl font-black text-white">{title}</h3><p className="mt-2 text-blue-100">{text}</p></article>)}</div></div></section>

        <section className="bg-blue-50 py-16 md:py-20"><div className="shell"><p className="landing-eyebrow">Démonstration</p><h2 className="landing-title">Voyez l’application en action.</h2><p className="landing-intro">Rappel, envoi d’une copie, analyse des réussites et orientation : testez les trois écrans.</p><div className="mt-10"><LandingDemo /></div></div></section>

        <section className="shell py-16 md:py-20"><div className="grid gap-10 lg:grid-cols-2 lg:items-start"><div><p className="landing-eyebrow">Tout est inclus</p><h2 className="landing-title">Un seul achat. Tout le parcours.</h2><p className="landing-intro">Vous téléchargez immédiatement le guide PDF et activez l’application pour accompagner le travail de l’élève pendant la 3e.</p></div><ul className="grid gap-3 sm:grid-cols-2">{pack.map((item) => <li key={item} className="flex gap-3 rounded-2xl border border-slate-200 p-4 font-bold text-slate-800"><span className="text-emerald-600">✓</span>{item}</li>)}</ul></div></section>

        <section className="bg-emerald-900 py-14 text-white"><div className="shell"><p className="max-w-3xl text-lg font-black">Le programme de rappel de 14 jours contient 125 activités pédagogiques.</p><div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{[["65", "exercices"], ["13", "exemples guidés"], ["13", "défis"], ["13", "situations réelles"], ["21", "questions finales"]].map(([number, label]) => <div key={label} className="rounded-3xl bg-white/10 p-5"><p className="text-3xl font-black text-yellow-300">{number}</p><p className="mt-1 text-sm font-bold">{label}</p></div>)}</div></div></section>

        <section className="shell py-16 md:py-20"><div className="grid gap-8 lg:grid-cols-2 lg:items-center"><div><p className="landing-eyebrow">Suivi parental</p><h2 className="landing-title">Suivez sans devenir professeur.</h2><p className="landing-intro">En un coup d’œil : travail réalisé, progrès et points à revoir.</p></div><div className="grid grid-cols-2 gap-3">{["Travail régulier", "Notions maîtrisées", "Points à reprendre", "Prochaine étape"].map((item) => <div key={item} className="rounded-3xl bg-blue-50 p-5 font-black text-blue-950">✓ {item}</div>)}</div></div></section>

        <section className="bg-slate-50 py-16 md:py-20"><div className="shell"><div className="mx-auto max-w-3xl text-center"><p className="landing-eyebrow">Retour réel d’un parent</p><h2 className="landing-title mx-auto">Après les 14 jours, les progrès se voient.</h2><p className="landing-intro mx-auto">Résultat envoyé par un parent après les 14 jours. Les informations personnelles ont été masquées.</p></div><div className="mx-auto mt-9 grid max-w-4xl gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"><figure className="mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] bg-white shadow-xl ring-1 ring-slate-200"><Image src="/images/proofs/temoignage-parent-14-jours-90-anonyme.png" alt="Capture anonymisée du retour d’un parent après le test des 14 jours" width={592} height={1056} className="h-auto w-full" /><figcaption className="border-t border-slate-100 px-5 py-4 text-xs font-bold text-slate-500">Retour parent anonymisé · identité masquée</figcaption></figure><div className="rounded-[2rem] bg-emerald-950 p-7 text-white sm:p-9"><p className="text-sm font-black uppercase tracking-wider text-yellow-300">Ce que cette preuve montre</p><p className="mt-5 text-2xl font-black leading-snug">Retour du parent : son enfant a terminé les 14 jours de révision et a obtenu 90 % au test final.</p><div className="mt-7 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-black text-yellow-300">90 %</p><p className="mt-1 text-sm text-emerald-100">au test final</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-black text-yellow-300">19/21</p><p className="mt-1 text-sm text-emerald-100">bonnes réponses</p></div></div><p className="mt-6 text-sm leading-7 text-emerald-100">Ce résultat correspond à l’expérience de cet enfant. Il illustre le type de progression recherchée, sans garantir un score identique pour chaque élève.</p></div></div></div></section>

        <section className="bg-slate-950 py-16 text-white"><div className="shell grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"><div><p className="landing-eyebrow-on-dark">Après votre achat</p><h2 className="landing-title-on-dark">Payez en un clic. Téléchargez le PDF. Activez l’application.</h2><ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[["1", "Téléchargez le guide", "Votre PDF Réussir les Maths 3e est disponible après le paiement."], ["2", "Recevez la clé", "Votre clé d’activation Elan Scolaire est disponible après l’achat."], ["3", "Activez l’espace", "Créez le compte parent et associez votre enfant."], ["4", "Commencez le parcours", "L’élève démarre les 14 jours puis poursuit son accompagnement."], ["5", "Rejoignez WhatsApp", "Le groupe complète le guide et l’application."]].map(([number, title, text]) => <li key={number} className="rounded-3xl bg-white/10 p-5"><p className="text-2xl font-black text-yellow-300">{number}</p><h3 className="mt-3 font-black">{title}</h3><p className="mt-2 text-sm text-slate-300">{text}</p></li>)}</ol></div><div className="rounded-[2rem] bg-white p-6 text-slate-950 sm:p-8"><p className="text-sm font-black uppercase tracking-wider text-emerald-700">Moyens de paiement</p><div className="mt-5 grid grid-cols-2 gap-3">{["MTN Money", "Moov Money", "Orange Money", "Visa", "Mastercard"].map((item) => <div key={item} className="rounded-2xl border border-slate-200 px-4 py-3 text-center font-black">{item}</div>)}</div><p className="mt-5 text-sm leading-7 text-slate-600">Cliquez sur le bouton ci-dessous pour acheter le pack et recevoir votre guide PDF avec votre clé d’activation.</p><div className="mt-6"><PurchaseLink compact className="w-full" /></div></div></div></section>

        <section className="shell py-16 md:py-20"><p className="landing-eyebrow">Questions fréquentes</p><h2 className="landing-title">Les réponses avant de commencer.</h2><div className="mt-9 grid gap-4 lg:grid-cols-2">{faq.map(([question, answer]) => <details key={question} className="faq-card group"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-slate-950"><span>{question}</span><span aria-hidden="true" className="text-2xl text-emerald-700 transition group-open:rotate-45">+</span></summary><p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-7 text-slate-600">{answer}</p></details>)}</div></section>

        <section className="landing-final py-16 text-center text-white md:py-20"><div className="shell"><p className="landing-eyebrow text-yellow-300">Réussir les Maths 3e</p><h2 className="mx-auto mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">Un parcours clair jusqu’au BEPC.</h2><p className="mt-7 text-2xl font-black text-yellow-300"><PriceLine deadline={offerDeadline} /></p><div className="mt-8"><PurchaseLink compact className="w-full sm:w-auto" /></div></div></section>
      </main>
      <PublicFooter />
    </div>
  );
}
