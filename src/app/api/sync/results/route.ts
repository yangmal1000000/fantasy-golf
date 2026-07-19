import { NextResponse } from "next/server";
import { syncTournamentResults } from "@/lib/data-sync";

/**
 * POST /api/sync/results
 * Pulls real scores from ESPN for all completed tournaments.
 * Optionally accepts ?tournamentId=xxx to sync a single tournament.
 * Called by cron or admin — no auth check.
 */
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get("tournamentId") ?? undefined;

    const result = await syncTournamentResults(tournamentId);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    console.error("sync/results error:", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}
