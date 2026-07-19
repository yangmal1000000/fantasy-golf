import { NextResponse } from "next/server";
import { syncOWGRRankings, linkPlayersToTournaments } from "@/lib/data-sync";

/**
 * POST /api/sync/rankings
 * Pulls world golf rankings from ESPN and updates all players,
 * then links players to tournaments with proper tiers.
 * Called by cron or admin — no auth check.
 */
export async function POST() {
  try {
    const rankResult = await syncOWGRRankings();

    // After updating rankings, link players to tournaments
    const linkResult = await linkPlayersToTournaments();

    return NextResponse.json({
      ...rankResult,
      details: {
        ...rankResult.details,
        linksCreated: linkResult.created,
        linksSkipped: linkResult.skipped,
      },
    });
  } catch (e) {
    console.error("sync/rankings error:", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}
