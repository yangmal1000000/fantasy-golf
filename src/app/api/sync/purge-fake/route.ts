import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 55;

/**
 * POST /api/sync/purge-fake
 * Deletes old fake data in small batches to avoid timeouts.
 * Call repeatedly until remaining.fakeTournaments === 0.
 */
export async function POST() {
  try {
    // 1. Delete a few year-suffixed tournaments (max 5 per request)
    const fakeTournaments = await prisma.tournament.findMany({
      where: { id: { contains: "-2026" } },
      take: 5,
      select: { id: true },
    });

    let deleted = 0;
    for (const t of fakeTournaments) {
      try {
        await prisma.$transaction([
          prisma.teamSelection.deleteMany({ where: { team: { tournamentId: t.id } } }),
          prisma.score.deleteMany({ where: { tournamentId: t.id } }),
          prisma.tournamentPlayer.deleteMany({ where: { tournamentId: t.id } }),
          prisma.team.deleteMany({ where: { tournamentId: t.id } }),
        ]).catch(() => {});
        await prisma.broadcastMessage.deleteMany({ where: { tournamentId: t.id } }).catch(() => {});
        await prisma.sideBet.deleteMany({ where: { tournamentId: t.id } }).catch(() => {});
        await prisma.tournamentSidePot.deleteMany({ where: { tournamentId: t.id } }).catch(() => {});
        await prisma.tournament.delete({ where: { id: t.id } }).catch(() => {});
        deleted++;
      } catch {}
    }

    // Also check 2027
    const fake2027 = await prisma.tournament.findMany({
      where: { id: { contains: "-2027" } },
      take: 5,
      select: { id: true },
    });
    for (const t of fake2027) {
      try {
        await prisma.$transaction([
          prisma.teamSelection.deleteMany({ where: { team: { tournamentId: t.id } } }),
          prisma.score.deleteMany({ where: { tournamentId: t.id } }),
          prisma.tournamentPlayer.deleteMany({ where: { tournamentId: t.id } }),
          prisma.team.deleteMany({ where: { tournamentId: t.id } }),
        ]).catch(() => {});
        await prisma.tournament.delete({ where: { id: t.id } }).catch(() => {});
        deleted++;
      } catch {}
    }

    // 2. Delete fake players (player-N format) in small batches
    const fakePlayers = await prisma.player.findMany({
      where: { OR: [{ id: { startsWith: "player-" } }, { id: { startsWith: "wplayer-" } }] },
      take: 20,
      select: { id: true },
    });

    let playersDeleted = 0;
    if (fakePlayers.length > 0) {
      const ids = fakePlayers.map((p: { id: string }) => p.id);
      for (const pid of ids) {
        await prisma.score.deleteMany({ where: { playerId: pid } }).catch(() => {});
        await prisma.tournamentPlayer.deleteMany({ where: { playerId: pid } }).catch(() => {});
      }
      const result = await prisma.player.deleteMany({ where: { id: { in: ids } } }).catch(() => ({ count: 0 }));
      playersDeleted = result.count;
    }

    // 3. Count remaining
    const remainingFake = await prisma.tournament.count({
      where: { OR: [{ id: { contains: "-2026" } }, { id: { contains: "-2027" } }] },
    });
    const remainingFakePlayers = await prisma.player.count({
      where: { OR: [{ id: { startsWith: "player-" } }, { id: { startsWith: "wplayer-" } }] },
    });
    const realTournaments = await prisma.tournament.count();
    const realPlayers = await prisma.player.count();

    return NextResponse.json({
      deletedTournaments: deleted,
      deletedPlayers: playersDeleted,
      remainingFakeTournaments: remainingFake,
      remainingFakePlayers: remainingFakePlayers,
      real: { tournaments: realTournaments, players: realPlayers },
      done: remainingFake === 0 && remainingFakePlayers === 0,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 500) }, { status: 500 });
  }
}
