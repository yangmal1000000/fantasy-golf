import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tierForRank } from "@/lib/data-sync";
import { adminApiGuard } from "@/lib/admin-auth";
import { ROCKET_FIELD_TOURNAMENT_ID } from "@/lib/rocket-tiers";

export const maxDuration = 300;

/**
 * POST /api/sync/recalc-tiers
 * Recalculates global rank-band tiers for ordinary TournamentPlayer records.
 * Rocket is excluded because its tiers are field-relative and source-frozen.
 * Pass ?offset=N to skip ahead (for chunked invocation).
 */
export async function POST(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const BATCH = 500;

  const tournamentPlayers = await prisma.tournamentPlayer.findMany({
    where: { tournamentId: { not: ROCKET_FIELD_TOURNAMENT_ID } },
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

  const total = await prisma.tournamentPlayer.count({
    where: { tournamentId: { not: ROCKET_FIELD_TOURNAMENT_ID } },
  });
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
