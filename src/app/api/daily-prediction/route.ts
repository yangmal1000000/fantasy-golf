import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureSchema, genId } from "@/lib/db-ensure";

export const dynamic = "force-dynamic";

// GET — current user's predictions for a tournament, the user's current streak,
// the daily leaderboard, and the tournament players to choose from.
export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get("tournamentId");
  if (!tournamentId) {
    return NextResponse.json({ error: "tournamentId required" }, { status: 400 });
  }

  const user = await getCurrentUser();
  await ensureSchema();

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      players: { include: { player: true } },
    },
  });
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  // Determine the active round for picks
  const activeRound = Math.max(1, tournament.currentRound || 1);

  // Fetch user's predictions for this tournament
  let myPredictions: any[] = [];
  if (user) {
    myPredictions = await prisma.$queryRawUnsafe(
      `SELECT id, "playerId", round, "createdAt"
         FROM "DailyPrediction"
        WHERE "userId" = $1 AND "tournamentId" = $2
        ORDER BY round ASC`,
      user.id,
      tournamentId,
    );
  }

  // Compute streak — consecutive rounds (1..N) where user's pick had the
  // lowest round score across all picks for that round. We only count rounds
  // that have a completed score on the books.
  let streak = 0;
  if (user) {
    for (let r = 1; r <= 4; r++) {
      const picks: any[] = await prisma.$queryRawUnsafe(
        `SELECT dp."userId", dp."playerId", s.strokes
           FROM "DailyPrediction" dp
           LEFT JOIN "Score" s
             ON s."tournamentId" = dp."tournamentId"
            AND s."playerId" = dp."playerId"
            AND s.round = dp.round
          WHERE dp."tournamentId" = $1 AND dp.round = $2`,
        tournamentId,
        r,
      );
      // If any pick has null strokes the round isn't complete — stop.
      if (picks.length === 0) break;
      if (picks.some((p) => p.strokes == null)) break;

      // Lowest strokes among all pickers that round
      const lowest = Math.min(...picks.map((p) => p.strokes));
      const myPick = picks.find((p) => p.userId === user.id);
      if (myPick && myPick.strokes === lowest) {
        streak++;
      } else {
        break;
      }
    }
  }

  // Daily Prediction leaderboard — sum of strokes for each user across all
  // rounds where they made a pick (lower is better).
  const leaderboardRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT dp."userId",
            u.name AS "userName",
            u.avatar AS "userAvatar",
            COUNT(*) AS picks,
            COALESCE(SUM(s.strokes), 0) AS total
       FROM "DailyPrediction" dp
       JOIN "User" u ON u.id = dp."userId"
  LEFT JOIN "Score" s
         ON s."tournamentId" = dp."tournamentId"
        AND s."playerId" = dp."playerId"
        AND s.round = dp.round
      WHERE dp."tournamentId" = $1
   GROUP BY dp."userId", u.name, u.avatar
   ORDER BY total ASC, picks DESC
      LIMIT 50`,
    tournamentId,
  );

  return NextResponse.json({
    activeRound,
    tournament: {
      id: tournament.id,
      name: tournament.name,
      status: tournament.status,
      par: tournament.par,
    },
    players: tournament.players.map((tp) => ({
      playerId: tp.playerId,
      name: tp.player.name,
      country: tp.player.country,
      tier: tp.tier,
      withdrew: tp.withdrew,
    })),
    myPredictions: myPredictions.map((p) => ({
      id: p.id,
      playerId: p.playerId,
      round: p.round,
      createdAt: new Date(p.createdAt).toISOString(),
    })),
    streak,
    leaderboard: leaderboardRows.map((r, i) => ({
      position: i + 1,
      userId: r.userId,
      userName: r.userName ?? "Anonymous",
      userAvatar: r.userAvatar ?? null,
      picks: Number(r.picks),
      total: Number(r.total),
    })),
  });
}

// POST — create or update a daily prediction for a round
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    const { tournamentId, playerId, round } = body as {
      tournamentId?: string;
      playerId?: string;
      round?: number;
    };

    if (!tournamentId || !playerId || typeof round !== "number") {
      return NextResponse.json({ error: "tournamentId, playerId, round required" }, { status: 400 });
    }
    if (round < 1 || round > 4) {
      return NextResponse.json({ error: "Invalid round" }, { status: 400 });
    }

    await ensureSchema();

    // Validate tournament
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }
    if (tournament.status === "completed") {
      return NextResponse.json({ error: "Tournament is complete" }, { status: 400 });
    }

    // Validate player belongs to tournament
    const tp = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId } },
    });
    if (!tp) {
      return NextResponse.json({ error: "Player not in tournament" }, { status: 400 });
    }
    if (tp.withdrew) {
      return NextResponse.json({ error: "Player has withdrawn" }, { status: 400 });
    }

    // Don't allow picks for a round already in the past (currentRound > round)
    if (tournament.currentRound > round) {
      return NextResponse.json(
        { error: `Round ${round} has already started — pick is locked` },
        { status: 400 },
      );
    }

    const id = genId();

    // Upsert via raw SQL — ON CONFLICT on (userId, tournamentId, round)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DailyPrediction" (id, "userId", "tournamentId", "playerId", round)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("userId", "tournamentId", round)
       DO UPDATE SET "playerId" = EXCLUDED."playerId"`,
      id,
      user.id,
      tournamentId,
      playerId,
      round,
    );

    return NextResponse.json({
      success: true,
      prediction: {
        id,
        playerId,
        round,
      },
    });
  } catch (err) {
    console.error("daily-prediction POST error:", err);
    return NextResponse.json({ error: "Failed to save prediction" }, { status: 500 });
  }
}
