import { NextResponse } from "next/server";
import { syncTournamentSchedule } from "@/lib/data-sync";

/**
 * POST /api/sync/schedule
 * Pulls real PGA Tour schedule from ESPN and updates the database.
 * Called by cron or admin — no auth check.
 */
export async function POST() {
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
