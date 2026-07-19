import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ScoreEditor from "./ScoreEditor";

export const dynamic = "force-dynamic";

export default async function ScoresPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [tournament, tournamentPlayers, scores] = await Promise.all([
    prisma.tournament.findUnique({ where: { id } }),
    prisma.tournamentPlayer.findMany({
      where: { tournamentId: id },
      include: { player: true },
      orderBy: { player: { dataGolfRank: "asc" } },
    }),
    prisma.score.findMany({
      where: { tournamentId: id },
      orderBy: { round: "asc" },
    }),
  ]);

  if (!tournament) notFound();

  const playersWithScores = tournamentPlayers.map((tp) => {
    const playerScores = [1, 2, 3, 4].map((round) => {
      const s = scores.find(
        (sc) => sc.playerId === tp.playerId && sc.round === round
      );
      return s ? { strokes: s.strokes, isEstimated: s.isEstimated } : null;
    });

    const total = playerScores.reduce<number>(
      (sum, s) => sum + (s?.strokes ?? 0),
      0
    );
    const playedRounds = playerScores.filter((s) => s?.strokes != null).length;

    return {
      playerId: tp.playerId,
      tournamentPlayerId: tp.id,
      name: tp.player.name,
      rank: tp.player.dataGolfRank,
      tier: tp.tier,
      madeCut: tp.madeCut,
      withdrew: tp.withdrew,
      scores: playerScores,
      total,
      playedRounds,
    };
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <nav className="mb-2 text-sm text-zinc-500">
          <a href="/admin/tournaments" className="hover:underline">Tournaments</a>
          {" / "}
          <span className="text-zinc-700">{tournament.name}</span>
        </nav>
        <h1 className="text-2xl font-bold text-zinc-900">
          Scores — {tournament.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter scores manually or fetch from CBS Sports. Par {tournament.par}.
        </p>
      </div>
      <ScoreEditor
        tournamentId={id}
        par={tournament.par}
        currentRound={tournament.currentRound}
        players={playersWithScores}
      />
    </div>
  );
}
