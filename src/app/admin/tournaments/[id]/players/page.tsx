import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PlayerManager from "./PlayerManager";

export const dynamic = "force-dynamic";

export default async function PlayersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      players: {
        include: { player: true },
        orderBy: { player: { dataGolfRank: "asc" } },
      },
    },
  });

  if (!tournament) notFound();

  // Get all available players (for adding)
  const allPlayers = await prisma.player.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, country: true, dataGolfRank: true },
  });

  const tournamentPlayerIds = new Set(tournament.players.map((tp) => tp.playerId));
  const availablePlayers = allPlayers.filter((p) => !tournamentPlayerIds.has(p.id));

  const serialized = tournament.players.map((tp) => ({
    id: tp.id,
    playerId: tp.playerId,
    tier: tp.tier,
    madeCut: tp.madeCut,
    withdrew: tp.withdrew,
    selectionCount: tp.selectionCount,
    name: tp.player.name,
    country: tp.player.country,
    dataGolfRank: tp.player.dataGolfRank,
  }));

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <nav className="mb-2 text-sm text-zinc-500">
          <a href="/admin/tournaments" className="hover:underline">Tournaments</a>
          {" / "}
          <span className="text-zinc-700">{tournament.name}</span>
        </nav>
        <h1 className="text-2xl font-bold text-zinc-900">
          Players — {tournament.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage player tiers, cut status, and tournament field
        </p>
      </div>
      <PlayerManager
        tournamentId={id}
        tournamentName={tournament.name}
        players={serialized}
        availablePlayers={availablePlayers}
      />
    </div>
  );
}
