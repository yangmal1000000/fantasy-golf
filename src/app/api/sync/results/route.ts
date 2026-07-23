import { NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/admin-auth";
import { syncTournamentResults } from "@/lib/data-sync";

export const maxDuration = 300;

async function syncResults(request: Request) {
  const denied = await adminApiGuard(request, { allowCron: true });
  if (denied) return denied;

  try {
    const tournamentId = await selectedTournamentId(request);
    const result = await syncTournamentResults(tournamentId);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
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
