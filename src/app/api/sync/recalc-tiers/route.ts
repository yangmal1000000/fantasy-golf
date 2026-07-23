import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tierForRank } from "@/lib/data-sync";
import { adminApiGuard } from "@/lib/admin-auth";

export const maxDuration = 300;

/**
 * POST /api/sync/recalc-tiers
 * Recalculates tier assignments for ALL TournamentPlayer records
 * based on their player's current dataGolfRank. No ESPN fetch.
 * Pass ?offset=N to skip ahead (for chunked invocation).
 */
export async function POST(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const BATCH = 500;

  const tournamentPlayers = await prisma.tournamentPlayer.findMany({
    include: { player: { select: { dataGolfRank: true } } },
    skip: offset,
    take: BATCH,
    orderBy: { id: "asc" },
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

  const total = await prisma.tournamentPlayer.count();
  const processed = offset + tournamentPlayers.length;

  return NextResponse.json({
    checked: tournamentPlayers.length,
    changed,
    offset,
    processed,
    total,
    done: processed >= total,
    nextOffset: processed < total ? processed : null,
  });
}
