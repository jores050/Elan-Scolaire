import { PublicFooter, PublicHeader } from "@/components/shell";

export default function ConfidentialitePage() {
  return (
    <div>
      <PublicHeader />
      <main className="shell py-14">
        <div className="mx-auto max-w-3xl card space-y-4">
          <h1 className="text-3xl font-bold text-slate-950">Confidentialité</h1>
          <p className="text-sm leading-7 text-slate-600">Le compte appartient au parent. Nous collectons le minimum utile : prénom ou pseudonyme de l’élève, classe, progression et travaux envoyés pour l’analyse pédagogique.</p>
          <p className="text-sm leading-7 text-slate-600">Les photos d’exercices servent uniquement à l’analyse d’accompagnement Elan Scolaire. Elles ne sont pas publiques.</p>
          <p className="text-sm leading-7 text-slate-600">Aucune donnée privée d’un autre élève ne doit être publiée dans le groupe d’accompagnement.</p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
