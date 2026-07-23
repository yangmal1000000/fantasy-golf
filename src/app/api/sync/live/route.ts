import { NextResponse } from "next/server";
import { syncLiveScores } from "@/lib/data-sync";
import { adminApiGuard } from "@/lib/admin-auth";
import { isAuthorizedCronHeader } from "@/lib/cron-auth";
import {
  ROCKET_LIVE_SYNC_START,
  ROCKET_LIVE_SYNC_STOP,
  isRocketLiveSyncWindow,
} from "@/lib/rocket-live-window";

export const maxDuration = 60;

/**
 * POST /api/sync/live
 * Pulls current round scores from ESPN for any in-progress tournament.
 * Optionally accepts ?tournamentId=xxx to sync a single tournament.
 * Called by a signed scheduler during live tournaments or by an authenticated admin.
 */
async function syncLive(request: Request) {
  const denied = await adminApiGuard(request, { allowCron: true });
  if (denied) return denied;
  try {
    const isScheduledRun = isAuthorizedCronHeader(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    );
    if (isScheduledRun && !isRocketLiveSyncWindow()) {
      return NextResponse.json({
        ok: true,
        skipped: 1,
        details: {
          message: "Outside the Rocket Classic live-scoring window",
          startsAt: ROCKET_LIVE_SYNC_START.toISOString(),
          stopsAt: ROCKET_LIVE_SYNC_STOP.toISOString(),
        },
      });
    }

    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get("tournamentId") ?? undefined;

    const result = await syncLiveScores(tournamentId);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    console.error("sync/live error:", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}

export const GET = syncLive;
export const POST = syncLive;
