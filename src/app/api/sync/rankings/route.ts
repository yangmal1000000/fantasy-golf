import { NextResponse } from "next/server";
import { syncOWGRRankings, recalculateAllTiers } from "@/lib/data-sync";
import { adminApiGuard } from "@/lib/admin-auth";

// Maximum duration for Vercel serverless function
export const maxDuration = 300;

/**
 * POST /api/sync/rankings
 * Pulls world golf rankings from ESPN and updates all players,
 * then links players to tournaments with proper tiers.
 * Called by a signed Vercel cron or an authenticated admin.
 */
async function syncRankings(request: Request) {
  const denied = await adminApiGuard(request, { allowCron: true });
  if (denied) return denied;
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

export const GET = syncRankings;
export const POST = syncRankings;
