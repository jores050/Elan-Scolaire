import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { SUPPORT_GROUP_URL } from "@/lib/config";
import { listStudentsForParent } from "@/lib/app-data";
import { PremiumGate } from "@/components/premium-gate";

export default async function AccompagnementPage() {
  const user = await requireUser();
  if (user.role !== "parent") redirect("/admin");
  const student = (await listStudentsForParent(user.id))[0];
  if (!student) redirect("/app");
  if (!user.activeLicenseId) {
    return (
      <AppShell title="Groupe d’accompagnement">
        <PremiumGate />
      </AppShell>
    );
  }
  return (
    <AppShell title="Groupe d’accompagnement Elan Scolaire">
      <div className="card">
        <p className="text-sm leading-7 text-slate-600">Posez vos questions sur les exercices, les notions de 3e et la préparation des devoirs.</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>Mathématiques niveau 3e</li>
          <li>Questions liées au travail scolaire</li>
          <li>Respect entre membres</li>
          <li>Aucune publication de données personnelles d’un autre élève</li>
          <li>L’accompagnement ne remplace pas les cours de l’établissement</li>
        </ul>
        <div className="mt-6">
          <a href={SUPPORT_GROUP_URL || "#"} className="btn-primary">Rejoindre le groupe</a>
        </div>
      </div>
    </AppShell>
  );
}
