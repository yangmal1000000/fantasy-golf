import { NextResponse } from "next/server";
import { syncTournamentSchedule } from "@/lib/data-sync";
import { adminApiGuard } from "@/lib/admin-auth";

export const maxDuration = 60;

/**
 * POST /api/sync/schedule
 * Pulls real PGA Tour schedule from ESPN and updates the database.
 * Called by a signed Vercel cron or an authenticated admin.
 */
async function syncSchedule(request: Request) {
  const denied = await adminApiGuard(request, { allowCron: true });
  if (denied) return denied;
  try {
    const result = await syncTournamentSchedule();
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    console.error("sync/schedule error:", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}

export const GET = syncSchedule;
export const POST = syncSchedule;
