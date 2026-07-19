import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tierForRank } from "@/lib/data-sync";

export const maxDuration = 300;

/**
 * POST /api/sync/recalc-tiers
 * Recalculates tier assignments for ALL TournamentPlayer records
 * based on their player's current dataGolfRank. No ESPN fetch.
 */
export async function POST() {
  const tournamentPlayers = await prisma.tournamentPlayer.findMany({
    include: { player: { select: { dataGolfRank: true } } },
    take: 500,
  });

  let changed = 0;
  for (const tp of tournamentPlayers) {
    const correct = tierForRank(tp.player.dataGolfRank);
    if (tp.tier !== correct) {
      await prisma.tournamentPlayer.update({
        where: { id: tp.id },
        data: { tier: correct },
      });
      changed++;
    }
  }

  const remaining = await prisma.tournamentPlayer.count();

  return NextResponse.json({
    checked: tournamentPlayers.length,
    changed,
    remaining,
    done: tournamentPlayers.length < 500,
  });
}
