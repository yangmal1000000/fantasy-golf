import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PayoutCalculator from "./PayoutCalculator";

export const dynamic = "force-dynamic";

export default async function PayoutsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({ where: { id } });

  if (!tournament) notFound();

  const teams = await prisma.team.findMany({
    where: { tournamentId: id, paid: true },
    orderBy: [{ position: "asc" }, { totalScore: "asc" }],
    include: { user: true },
  });

  const serialized = teams.map((t) => ({
    id: t.id,
    name: t.name,
    position: t.position,
    totalScore: t.totalScore,
    userName: t.user?.name ?? t.user?.email ?? "Unknown",
  }));

  const entryFee = tournament.entryFee;
  const prizePool = teams.length * entryFee;

  let savedStructure: Array<{ position: number; percentage: number }> | null = null;
  if (tournament.payoutStructure) {
    try {
      savedStructure = JSON.parse(tournament.payoutStructure);
    } catch {
      // ignore parse errors
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <nav className="mb-2 text-sm text-zinc-500">
          <a href="/admin/tournaments" className="hover:underline">Tournaments</a>
          {" / "}
          <span className="text-zinc-700">{tournament.name}</span>
        </nav>
        <h1 className="text-2xl font-bold text-zinc-900">
          Payouts — {tournament.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Configure the prize distribution for paid entries
        </p>
      </div>
      <PayoutCalculator
        tournamentId={id}
        entryFee={entryFee}
        prizePool={prizePool}
        paidTeamCount={teams.length}
        teams={serialized}
        savedStructure={savedStructure}
      />
    </div>
  );
}
