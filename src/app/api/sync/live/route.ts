import { NextResponse } from "next/server";
import { syncLiveScores } from "@/lib/data-sync";

/**
 * POST /api/sync/live
 * Pulls current round scores from ESPN for any in-progress tournament.
 * Optionally accepts ?tournamentId=xxx to sync a single tournament.
 * Called by cron every 5 minutes during live tournaments — no auth check.
 */
export async function POST(request: Request) {
  try {
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
