import { NextResponse } from "next/server";
import { syncTournamentSchedule } from "@/lib/data-sync";
import { adminApiGuard } from "@/lib/admin-auth";
import {
  beginOperationalRun,
  completeOperationalRun,
} from "@/lib/operational-jobs";

export const maxDuration = 60;

/**
 * POST /api/sync/schedule
 * Pulls real PGA Tour schedule from ESPN and updates the database.
 * Called by a signed Vercel cron or an authenticated admin.
 */
async function syncSchedule(request: Request) {
  const denied = await adminApiGuard(request, { allowCron: true });
  if (denied) return denied;
  const run = await beginOperationalRun(
    {
      key: "tournament-schedule-sync",
      name: "Tournament schedule sync",
      source: "vercel-cron",
      expectedIntervalMinutes: 31 * 24 * 60,
      staleAfterMinutes: 35 * 24 * 60,
    },
    request.headers.get("authorization") ? "scheduled" : "manual",
  );
  try {
    const result = await syncTournamentSchedule();
    await completeOperationalRun(run, {
      status: result.ok ? "SUCCESS" : "FAILED",
      recordsProcessed: (result.created ?? 0) + (result.updated ?? 0),
      summary: result.ok
        ? `${result.created ?? 0} tournaments created · ${
            result.updated ?? 0
          } updated`
        : undefined,
      errorSummary: result.ok ? undefined : "Tournament schedule sync failed",
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    await completeOperationalRun(run, {
      status: "FAILED",
      errorSummary: "Tournament schedule sync failed",
    });
    console.error("sync/schedule error:", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}

export const GET = syncSchedule;
export const POST = syncSchedule;
