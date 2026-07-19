import { NextResponse } from "next/server";
import { syncOWGRRankings, recalculateAllTiers } from "@/lib/data-sync";

// Maximum duration for Vercel serverless function
export const maxDuration = 60;

/**
 * POST /api/sync/rankings
 * Pulls world golf rankings from ESPN and updates all players,
 * then links players to tournaments with proper tiers.
 * Called by cron or admin — no auth check.
 */
export async function POST() {
  try {
    const rankResult = await syncOWGRRankings();

    // After updating rankings, recalculate tiers (fast - no new records)
    const tierResult = await recalculateAllTiers();

    return NextResponse.json({
      ...rankResult,
      details: {
        ...rankResult.details,
        tiersChanged: tierResult.tiersChanged,
        totalChecked: tierResult.totalChecked,
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
