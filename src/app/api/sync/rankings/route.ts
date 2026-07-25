import { NextResponse } from "next/server";
import { syncOWGRRankings, recalculateAllTiers } from "@/lib/data-sync";
import { adminApiGuard } from "@/lib/admin-auth";
import {
  beginOperationalRun,
  completeOperationalRun,
} from "@/lib/operational-jobs";

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
  const run = await beginOperationalRun(
    {
      key: "world-ranking-sync",
      name: "World ranking sync",
      source: "vercel-cron",
      expectedIntervalMinutes: 7 * 24 * 60,
      staleAfterMinutes: 8 * 24 * 60,
    },
    request.headers.get("authorization") ? "scheduled" : "manual",
  );
  try {
    const rankResult = await syncOWGRRankings();

    // After updating rankings, recalculate tiers (fast - no new records)
    const tierResult = await recalculateAllTiers();

    const result = {
      ...rankResult,
      details: {
        ...rankResult.details,
        tiersChanged: tierResult.tiersChanged,
        totalChecked: tierResult.totalChecked,
      },
    };
    await completeOperationalRun(run, {
      status: rankResult.ok ? "SUCCESS" : "FAILED",
      recordsProcessed:
        (rankResult.created ?? 0) + (rankResult.updated ?? 0),
      summary: rankResult.ok
        ? `${rankResult.created ?? 0} players created · ${
            rankResult.updated ?? 0
          } updated`
        : undefined,
      errorSummary: rankResult.ok ? undefined : "World ranking sync failed",
    });
    return NextResponse.json(result, { status: rankResult.ok ? 200 : 502 });
  } catch (e) {
    await completeOperationalRun(run, {
      status: "FAILED",
      errorSummary: "World ranking sync failed",
    });
    console.error("sync/rankings error:", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}

export const GET = syncRankings;
export const POST = syncRankings;
