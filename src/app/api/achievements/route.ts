import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureSchema, genId } from "@/lib/db-ensure";
import { ACHIEVEMENT_DEFS, evaluateAchievements, type AchievementStats } from "@/lib/achievements";

export const dynamic = "force-dynamic";

// GET — current user's achievements with progress
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    await ensureSchema();

    // Fetch existing earned achievements
    const earned: any[] = await prisma.$queryRawUnsafe(
      `SELECT type, "earnedAt" FROM "UserAchievement" WHERE "userId" = $1`,
      user.id,
    );
    const earnedSet = new Set(earned.map((e) => e.type));

    // Compute stats for evaluation
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const [teamsCount, paidTeamsCount, leaguesCount] = await Promise.all([
      prisma.team.count({ where: { userId: user.id } }),
      prisma.team.count({ where: { userId: user.id, paid: true } }),
      prisma.leagueMember.count({ where: { userId: user.id } }),
    ]);

    // Major teams this year (approximate — category "major" only)
    const majorTeamsRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(DISTINCT t."tournamentId")::int AS count
         FROM "Team" t
         JOIN "Tournament" tour ON tour.id = t."tournamentId"
        WHERE t."userId" = $1
          AND tour.category = 'major'
          AND tour."startDate" >= $2`,
      user.id,
      oneYearAgo,
    );
    const majorTeamsCount = Number(majorTeamsRows[0]?.count ?? 0);

    // Top 3 finishes (position field on Team)
    const top3Rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "Team" WHERE "userId" = $1 AND position IS NOT NULL AND position <= 3`,
      user.id,
    );
    const top3Finishes = Number(top3Rows[0]?.count ?? 0);

    const winsRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "Team" WHERE "userId" = $1 AND position = 1`,
      user.id,
    );
    const wins = Number(winsRows[0]?.count ?? 0);

    // First entry (earliest createdAt in tournament)
    const firstEntryRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(DISTINCT t."tournamentId")::int AS count
         FROM "Team" t
         WHERE t."userId" = $1
           AND t.id = (
             SELECT id FROM "Team" t2
             WHERE t2."tournamentId" = t."tournamentId"
             ORDER BY "createdAt" ASC LIMIT 1
           )`,
      user.id,
    );
    const firstEntryTournaments = Number(firstEntryRows[0]?.count ?? 0);

    // Prediction streak (best run from DailyPrediction)
    const streakRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT MAX(streak)::int AS max_streak FROM (
         SELECT round,
                "userId",
                COUNT(*) AS streak
           FROM (
             SELECT dp.round,
                    dp."userId",
                    ROW_NUMBER() OVER (ORDER BY dp.round) -
                    ROW_NUMBER() OVER (PARTITION BY dp."userId", dp.round ORDER BY dp.round) AS grp
               FROM "DailyPrediction" dp
              WHERE dp."userId" = $1
           ) x
          GROUP BY round, "userId", grp
       ) s`,
      user.id,
    );
    const predictionStreak = Number(streakRows[0]?.max_streak ?? 0);

    // League wins + dark horse wins — placeholder heuristics (no full
    // league-scoring data in scope). Set to 0; can be enriched later.
    const leagueWins = 0;
    const darkHorseWins = 0;

    const stats: AchievementStats = {
      teamsCount,
      paidTeamsCount,
      leaguesCount,
      majorTeamsCount,
      top3Finishes,
      wins,
      firstEntryTournaments,
      predictionStreak,
      leagueWins,
      darkHorseWins,
    };

    // Evaluate newly-earned achievements
    const shouldEarn = evaluateAchievements(stats);
    const newlyEarned = shouldEarn.filter((t) => !earnedSet.has(t));

    // Award new ones (best-effort)
    for (const type of newlyEarned) {
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "UserAchievement" (id, "userId", type)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          genId(),
          user.id,
          type,
        );
        // Notify
        await prisma.notification.create({
          data: {
            id: genId(),
            userId: user.id,
            title: `🏆 Achievement Unlocked!`,
            body: `You earned "${ACHIEVEMENT_DEFS.find((a) => a.type === type)?.label ?? type}"`,
            type: "achievement",
          },
        }).catch(() => {});
        earnedSet.add(type);
      } catch {
        /* ignore */
      }
    }

    // Build response with progress info
    return NextResponse.json({
      stats,
      achievements: ACHIEVEMENT_DEFS.map((def) => {
        const earnedAt = earned.find((e) => e.type === def.type)?.earnedAt ?? null;
        return {
          ...def,
          earned: earnedSet.has(def.type),
          earnedAt: earnedAt ? new Date(earnedAt).toISOString() : null,
          progress: progressFor(def.type, stats),
        };
      }),
    });
  } catch (err) {
    console.error("achievements GET error:", err);
    return NextResponse.json({ error: "Failed to load achievements" }, { status: 500 });
  }
}

function progressFor(type: string, stats: AchievementStats): { current: number; target: number } | null {
  switch (type) {
    case "first_steps":
      return { current: Math.min(stats.teamsCount, 1), target: 1 };
    case "major_player":
      return { current: stats.majorTeamsCount, target: 4 };
    case "podium_finish":
      return { current: stats.top3Finishes, target: 1 };
    case "champion":
      return { current: stats.wins, target: 1 };
    case "dark_horse_hero":
      return { current: stats.darkHorseWins, target: 1 };
    case "loyal_fan":
      return { current: stats.paidTeamsCount, target: 5 };
    case "league_champion":
      return { current: stats.leagueWins, target: 1 };
    case "social_butterfly":
      return { current: stats.leaguesCount, target: 3 };
    case "streak_master":
      return { current: stats.predictionStreak, target: 7 };
    case "early_bird":
      return { current: stats.firstEntryTournaments, target: 1 };
    default:
      return null;
  }
}
