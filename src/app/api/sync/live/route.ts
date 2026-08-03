import { NextResponse } from "next/server";
import { syncLiveScores } from "@/lib/data-sync";
import { adminApiGuard } from "@/lib/admin-auth";
import { isAuthorizedCronHeader } from "@/lib/cron-auth";
import {
  ROCKET_LIVE_SYNC_START,
  ROCKET_LIVE_SYNC_STOP,
  isRocketLiveSyncWindow,
} from "@/lib/rocket-live-window";
import {
  beginOperationalRun,
  completeOperationalRun,
} from "@/lib/operational-jobs";

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
  const run = await beginOperationalRun(
    {
      key: "rocket-live-scoring",
      name: "Rocket live scoring",
      source: "github-actions",
      expectedIntervalMinutes: 5,
      staleAfterMinutes: 15,
    },
    isAuthorizedCronHeader(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
      ? "scheduled"
      : "manual",
  );
  try {
    const { searchParams } = new URL(request.url);
    const isScheduledRun = isAuthorizedCronHeader(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    );
    const force = searchParams.get("force") === "true";
    const requireFinal = searchParams.get("requireFinal") === "true";
    if (isScheduledRun && !isRocketLiveSyncWindow() && !force) {
      await completeOperationalRun(run, {
        status: "SKIPPED",
        summary: "Outside the configured Rocket live-scoring window",
      });
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

    const tournamentId = searchParams.get("tournamentId") ?? undefined;

    const result = await syncLiveScores(tournamentId);
    const finalization = result.details?.finalization as
      | {
          ready?: boolean;
          finalized?: boolean;
          alreadyFinal?: boolean;
          issues?: string[];
        }
      | null
      | undefined;
    const finalGatePassed = Boolean(
      finalization?.ready &&
        (finalization.finalized || finalization.alreadyFinal),
    );
    const responseOk = result.ok && (!requireFinal || finalGatePassed);
    await completeOperationalRun(run, {
      status: responseOk ? "SUCCESS" : "FAILED",
      recordsProcessed:
        typeof result.updated === "number" ? result.updated : undefined,
      summary: responseOk
        ? requireFinal
          ? "Rocket scores synchronized and final result sealed"
          : "Live scores synchronized"
        : undefined,
      errorSummary: responseOk
        ? undefined
        : requireFinal
          ? finalization?.issues?.join("; ") || "Rocket finalization gate failed"
          : "Live score provider returned an error",
    });
    return NextResponse.json(
      responseOk
        ? result
        : {
            ...result,
            ok: false,
            error: requireFinal
              ? "Rocket finalization gate failed"
              : "Live score provider returned an error",
          },
      { status: responseOk ? 200 : requireFinal ? 409 : 502 },
    );
  } catch (e) {
    await completeOperationalRun(run, {
      status: "FAILED",
      errorSummary: "Live score synchronization failed",
    });
    console.error("sync/live error:", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}

export const GET = syncLive;
export const POST = syncLive;
