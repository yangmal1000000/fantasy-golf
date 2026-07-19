import { prisma } from "@/lib/prisma";
import { formatGBP, formatDateRange } from "@/lib/ui";
import TournamentList from "./TournamentList";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startDate: "desc" },
    include: {
      _count: { select: { teams: true, players: true } },
      teams: {
        where: { paid: true },
        select: { id: true },
      },
    },
  });

  const serialized = tournaments.map((t) => ({
    id: t.id,
    name: t.name,
    course: t.course,
    status: t.status,
    currentRound: t.currentRound,
    par: t.par,
    cutLine: t.cutLine,
    entryFee: t.entryFee,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
    teamCount: t._count.teams,
    paidCount: t.teams.length,
    playerCount: t._count.players,
    revenue: t.teams.length * t.entryFee,
  }));

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Tournaments</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Create and manage golf tournaments
        </p>
      </div>
      <TournamentList tournaments={serialized} />
    </div>
  );
}
