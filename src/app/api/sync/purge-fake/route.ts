import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

/**
 * POST /api/sync/purge-fake
 * Force-deletes ALL tournaments with year-suffixed IDs (e.g. "the-open-2026")
 * and old fake seeded players (player-1 through player-60, wplayer-*)
 * Keeps only real ESPN-synced data (clean slug IDs, real OWGR players)
 */
export async function POST() {
  const results = { tournamentsDeleted: 0, scoresDeleted: 0, tpsDeleted: 0, playersDeleted: 0, errors: [] as string[] };

  try {
    // 1. Find all year-suffixed tournaments
    const allTournaments = await prisma.tournament.findMany({ select: { id: true, name: true } });
    const fakeTournaments = allTournaments.filter((t: { id: string; name: string }) => /-20\d{2}$/.test(t.id));

    for (const t of fakeTournaments) {
      try {
        // Delete all related records first (order matters for FK constraints)
        await prisma.teamSelection.deleteMany({ where: { team: { tournamentId: t.id } } }).catch(() => {});
        await prisma.score.deleteMany({ where: { tournamentId: t.id } }).catch(() => {});
        await prisma.tournamentPlayer.deleteMany({ where: { tournamentId: t.id } }).catch(() => {});
        await prisma.team.deleteMany({ where: { tournamentId: t.id } }).catch(() => {});
        await prisma.broadcastMessage.deleteMany({ where: { tournamentId: t.id } }).catch(() => {});
        await prisma.sideBet.deleteMany({ where: { tournamentId: t.id } }).catch(() => {});
        await prisma.tournamentSidePot.deleteMany({ where: { tournamentId: t.id } }).catch(() => {});
        await prisma.tournament.delete({ where: { id: t.id } }).catch((e: unknown) => {
          results.errors.push(`Failed to delete ${t.id}: ${e instanceof Error ? e.message : String(e)}`);
        });
        results.tournamentsDeleted++;
      } catch (e) {
        results.errors.push(`${t.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 2. Delete fake seeded players (player-N and wplayer-N format)
    const fakePlayers = await prisma.player.findMany({
      where: {
        OR: [
          { id: { startsWith: "player-" } },
          { id: { startsWith: "wplayer-" } },
        ],
      },
      select: { id: true },
    });

    if (fakePlayers.length > 0) {
      const fakeIds = fakePlayers.map((p: { id: string }) => p.id);

      // Delete related records first
      for (const pid of fakeIds) {
        await prisma.score.deleteMany({ where: { playerId: pid } }).catch(() => {});
        await prisma.tournamentPlayer.deleteMany({ where: { playerId: pid } }).catch(() => {});
      }
      // Delete the fake players
      const deleted = await prisma.player.deleteMany({
        where: { id: { in: fakeIds } },
      }).catch(() => ({ count: 0 }));
      results.playersDeleted = deleted.count;
    }

    // 3. Count remaining real data
    const remainingTournaments = await prisma.tournament.count();
    const remainingPlayers = await prisma.player.count();
    const remainingScores = await prisma.score.count();

    return NextResponse.json({
      ...results,
      remaining: {
        tournaments: remainingTournaments,
        players: remainingPlayers,
        scores: remainingScores,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ...results, fatal: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}
