import { prisma } from "@/lib/prisma";
import SettingsPanel from "./SettingsPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      entryFee: true,
      payoutStructure: true,
      par: true,
      cutLine: true,
    },
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Configure defaults and manage tournament data
        </p>
      </div>
      <SettingsPanel tournaments={tournaments.map(t => ({
        id: t.id,
        name: t.name,
        status: t.status,
        entryFee: t.entryFee,
        payoutStructure: t.payoutStructure,
        par: t.par,
        cutLine: t.cutLine,
      }))} />
    </div>
  );
}
