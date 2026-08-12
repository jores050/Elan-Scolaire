import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { listStudentsForParent } from "@/lib/app-data";

export default async function BepcPage() {
  const user = await requireUser();
  if (user.role !== "parent") redirect("/admin");
  const student = (await listStudentsForParent(user.id))[0];
  if (!student) redirect("/app");
  return (
    <AppShell title="Préparation BEPC">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="card"><p className="text-sm text-slate-500">Sujets disponibles</p><p className="mt-2 text-3xl font-bold">6</p></div>
        <div className="card"><p className="text-sm text-slate-500">Sujets réalisés</p><p className="mt-2 text-3xl font-bold">2</p></div>
        <div className="card"><p className="text-sm text-slate-500">Thèmes faibles</p><p className="mt-2 text-lg font-bold">Thalès · Équations</p></div>
      </div>
    </AppShell>
  );
}
