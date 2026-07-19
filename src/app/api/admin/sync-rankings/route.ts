import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  syncRankingsFromOWGR,
  recalculateTiers,
} from "@/lib/ranking-sync";

/**
 * POST /api/admin/sync-rankings
 *
 * Fetches the latest Official World Golf Ranking from owgr.com and updates
 * all players' dataGolfRank fields, then recalculates tier assignments for
 * every TournamentPlayer record.
 *
 * Returns a summary of what changed.
 */
export async function POST() {
  try {
    // 1. Sync rankings from OWGR
    const syncResult = await syncRankingsFromOWGR();

    if (!syncResult) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Failed to fetch OWGR rankings. The site may be unavailable or the page structure changed.",
        },
        { status: 502 }
      );
    }

    // 2. Recalculate tiers for all TournamentPlayer records
    const tierResult = await recalculateTiers();

    // 3. Gather summary stats
    const totalPlayers = await prisma.player.count();
    const rankedPlayers = await prisma.player.count({
      where: { dataGolfRank: { not: null } },
    });

    return NextResponse.json({
      ok: true,
      ranking: {
        playersUpdated: syncResult.playersUpdated,
        playersMatched: syncResult.playersMatched,
        playersUnmatched: syncResult.playersUnmatched,
        warnings: syncResult.errors,
      },
      tiers: {
        tiersChanged: tierResult.tiersChanged,
        totalChecked: tierResult.totalChecked,
      },
      stats: {
        totalPlayers,
        rankedPlayers,
      },
    });
  } catch (e) {
    console.error("sync-rankings error:", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}
