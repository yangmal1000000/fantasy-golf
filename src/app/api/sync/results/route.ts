import { NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/admin-auth";
import { syncTournamentResults } from "@/lib/data-sync";
import {
  beginOperationalRun,
  completeOperationalRun,
} from "@/lib/operational-jobs";

export const maxDuration = 300;

async function syncResults(request: Request) {
  const denied = await adminApiGuard(request, { allowCron: true });
  if (denied) return denied;
  const run = await beginOperationalRun(
    {
      key: "tournament-results-sync",
      name: "Tournament results sync",
      source: "vercel-cron",
      expectedIntervalMinutes: 24 * 60,
      staleAfterMinutes: 26 * 60,
    },
    request.headers.get("authorization") ? "scheduled" : "manual",
  );

  try {
    const tournamentId = await selectedTournamentId(request);
    const result = await syncTournamentResults(tournamentId);
    await completeOperationalRun(run, {
      status: result.ok ? "SUCCESS" : "FAILED",
      recordsProcessed: (result.created ?? 0) + (result.updated ?? 0),
      summary: result.ok
        ? `${result.created ?? 0} scores created · ${result.updated ?? 0} updated`
        : undefined,
      errorSummary: result.ok ? undefined : "Tournament result sync failed",
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    await completeOperationalRun(run, {
      status: "FAILED",
      errorSummary: "Tournament result sync failed",
    });
    console.error("sync/results error:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to sync tournament results" },
      { status: 500 },
    );
  }
}

async function selectedTournamentId(request: Request) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("tournamentId")?.trim();
  if (fromQuery) return fromQuery.slice(0, 100);
  if (request.method !== "POST") return undefined;
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return undefined;
  }
  const body = (await request.json().catch(() => null)) as {
    tournamentId?: unknown;
  } | null;
  return typeof body?.tournamentId === "string" && body.tournamentId.trim()
    ? body.tournamentId.trim().slice(0, 100)
    : undefined;
}

export const GET = syncResults;
export const POST = syncResults;
