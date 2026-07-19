import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 55;

/**
 * POST /api/sync/wipe-players
 * Deletes ALL players, scores, and tournament-player links.
 * Use before re-running /api/sync/rankings for a clean OWGR top ~200.
 */
export async function POST() {
  try {
    const scores = await prisma.score.deleteMany({});
    const links = await prisma.tournamentPlayer.deleteMany({});
    const players = await prisma.player.deleteMany({});

    return NextResponse.json({
      ok: true,
      deleted: {
        players: players.count,
        scores: scores.count,
        tournamentPlayers: links.count,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}
