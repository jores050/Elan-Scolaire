import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getStudentSelectionForParent } from "@/lib/active-student";
import { requireParentAccess } from "@/lib/auth";
import { SUPPORT_GROUP_URL } from "@/lib/config";
import { PremiumGate } from "@/components/premium-gate";

export default async function AccompagnementPage() {
  const user = await requireParentAccess({ requireStudent: true });
  if (user.role !== "parent") redirect("/admin");
  const { activeStudent: student } = await getStudentSelectionForParent(user.id);
  if (!student) redirect("/app");
  if (!user.activeLicenseId) {
    return (
      <AppShell title="Accompagnement pendant l’année">
        <PremiumGate />
      </AppShell>
    );
  }
  return (
    <AppShell title="Accompagnement pendant l’année">
      <div className="card">
        <p className="text-sm leading-7 text-slate-600">Une difficulté sur le programme de la semaine ? Le groupe d’accompagnement est réservé aux familles Elan Scolaire.</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>Mathématiques niveau 3e</li>
          <li>Questions liées aux 14 jours de préparation et au suivi annuel</li>
          <li>Respect entre membres</li>
          <li>Aucune publication de données personnelles d’un autre élève</li>
          <li>L’accompagnement ne remplace pas les cours de l’établissement</li>
        </ul>
        <div className="mt-6">
          {SUPPORT_GROUP_URL ? (
            <a href={SUPPORT_GROUP_URL} className="btn-primary">Rejoindre le groupe</a>
          ) : (
            <p className="text-sm text-slate-600">Le lien du groupe d’accompagnement sera disponible ici.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
