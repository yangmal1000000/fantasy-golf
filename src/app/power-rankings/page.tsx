import { prisma } from "@/lib/prisma";
import { calculateLeaderboard } from "@/lib/scoring";
import { formatGBP } from "@/lib/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 300;

interface RankedTeam {
  teamId: string;
  teamName: string;
  ownerName: string;
  tournamentName: string;
  tournamentId: string;
  totalStrokes: number;
  position: number;
  vsPar: number;
  rank: number;
  commentary: string;
}

function commentaryFor(team: { position: number; vsPar: number }, idx: number): string {
  if (idx === 0) {
    return "The undisputed #1. The team to beat. Bowling over the competition.";
  }
  if (idx === 1) {
    return "Right on the leader's heels. One big round from taking the crown.";
  }
  if (idx === 2) {
    return "Podium pace — but needs a fast finish to climb higher.";
  }
  if (team.position === 1) {
    return "Leading their tournament. A true frontrunner.";
  }
  if (team.vsPar < 0) {
    return "Under par for the tournament — red numbers and rising.";
  }
  if (idx < 10) {
    return "In the hunt. A clutch weekend could push them up the board.";
  }
  return "Flying under the radar. Quietly making moves.";
}

export default async function PowerRankingsPage() {
  // Collect all in-progress tournaments
  const liveTournaments = await prisma.tournament.findMany({
    where: { status: { in: ["in_progress", "entries_open", "completed"] } },
    orderBy: { startDate: "desc" },
    take: 6,
  });

  // Build a flat list of teams across these tournaments with their scores
  const allTeams: Array<{
    teamId: string;
    teamName: string;
    ownerName: string;
    tournamentName: string;
    tournamentId: string;
    totalStrokes: number;
    position: number;
    vsPar: number;
  }> = [];

  for (const t of liveTournaments) {
    try {
      const results = await calculateLeaderboard(t.id);
      for (const r of results) {
        allTeams.push({
          teamId: r.teamId,
          teamName: r.teamName,
          ownerName: r.ownerName,
          tournamentName: t.name,
          tournamentId: t.id,
          totalStrokes: r.totalStrokes,
          position: r.position,
          vsPar: r.vsPar,
        });
      }
    } catch {
      /* skip */
    }
  }

  // Sort by vsPar ascending (most under par = best)
  // For completed tournaments, lower total is better; for in-progress, vsPar is more comparable.
  const ranked = allTeams
    .sort((a, b) => {
      // Sort primarily by vsPar (under par = better)
      if (a.vsPar !== b.vsPar) return a.vsPar - b.vsPar;
      return a.position - b.position;
    })
    .slice(0, 20);

  // Assign ranks
  const rankedWithMeta: RankedTeam[] = ranked.map((t, i) => ({
    ...t,
    rank: i + 1,
    commentary: commentaryFor(t, i),
  }));

  // Team of the Week — best single-round total across all teams in last round
  // (approximated by lowest total in a completed tournament this week)
  const teamOfTheWeek = rankedWithMeta.find(
    (t) => t.position === 1,
  );

  // Bust of the Week — worst-performing T1_10 player (highest average score among T1 players)
  let bust: { playerName: string; avgScore: number; tournamentName: string } | null = null;
  try {
    const recentTournamentId = liveTournaments[0]?.id;
    if (recentTournamentId) {
      const bustRows: any[] = await prisma.$queryRawUnsafe(
        `WITH t1_scores AS (
           SELECT tp."playerId", p.name AS "playerName",
                  AVG(s.strokes) AS avg_score
             FROM "TournamentPlayer" tp
             JOIN "Player" p ON p.id = tp."playerId"
             JOIN "Score" s ON s."playerId" = tp."playerId" AND s."tournamentId" = tp."tournamentId"
            WHERE tp."tournamentId" = $1
              AND tp.tier = 'T1_10'
              AND s.strokes IS NOT NULL
            GROUP BY tp."playerId", p.name
         )
         SELECT "playerName", avg_score
           FROM t1_scores
          ORDER BY avg_score DESC
          LIMIT 1`,
        recentTournamentId,
      );
      if (bustRows.length > 0) {
        bust = {
          playerName: bustRows[0].playerName,
          avgScore: Number(bustRows[0].avg_score),
          tournamentName: liveTournaments[0].name,
        };
      }
    }
  } catch {
    /* ignore */
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-6 text-white shadow-lg">
        <p className="text-xs uppercase tracking-wide text-white/60">Weekly AI Rankings</p>
        <h1 className="mt-1 text-2xl font-bold">📈 The Power Rankings</h1>
        <p className="mt-1 text-sm text-white/70">
          Top 20 fantasy teams across all active tournaments, ranked by scoring vs par.
        </p>
      </div>

      {/* Highlights */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {teamOfTheWeek && (
          <div className="rounded-2xl border-2 border-[#d4a843]/40 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
              ⭐ Team of the Week
            </p>
            <p className="mt-1 text-base font-bold text-[#0f3d20]">{teamOfTheWeek.teamName}</p>
            <p className="text-xs text-zinc-600">
              {teamOfTheWeek.ownerName} · {teamOfTheWeek.tournamentName}
            </p>
            <p className="mt-1 text-sm text-zinc-700">
              Total: {teamOfTheWeek.totalStrokes} ({teamOfTheWeek.vsPar === 0 ? "E" : `${teamOfTheWeek.vsPar > 0 ? "+" : ""}${teamOfTheWeek.vsPar}`})
            </p>
          </div>
        )}

        {bust && (
          <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-red-700">
              📉 Bust of the Week
            </p>
            <p className="mt-1 text-base font-bold text-[#0f3d20]">{bust.playerName}</p>
            <p className="text-xs text-zinc-600">
              Tier 1 · {bust.tournamentName}
            </p>
            <p className="mt-1 text-sm text-red-600">
              Avg round: {bust.avgScore.toFixed(1)} — for a top-10 ranked player!
            </p>
          </div>
        )}
      </div>

      {/* Rankings */}
      <div className="mt-6 rounded-2xl bg-white shadow-sm">
        <div className="border-b border-zinc-100 p-4">
          <h2 className="text-base font-bold text-[#0f3d20]">Top 20 Teams</h2>
        </div>

        {rankedWithMeta.length === 0 ? (
          <p className="p-4 text-sm text-zinc-400">
            No active tournament data yet. Check back once rounds begin.
          </p>
        ) : (
          <div className="divide-y divide-zinc-50">
            {rankedWithMeta.map((t) => (
              <Link
                key={t.teamId}
                href={`/tournaments/${t.tournamentId}/teams/${t.teamId}`}
                className="flex items-start gap-3 p-4 transition hover:bg-zinc-50"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  t.rank === 1
                    ? "bg-[#d4a843] text-[#1a3a20]"
                    : t.rank <= 3
                      ? "bg-[#1a6b3c] text-white"
                      : "bg-zinc-100 text-zinc-600"
                }`}>
                  {t.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-zinc-800">{t.teamName}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {t.ownerName} · {t.tournamentName}
                  </p>
                  <p className="mt-0.5 text-xs italic text-zinc-400">{t.commentary}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-[#0f3d20]">{t.totalStrokes}</p>
                  <p className={`text-xs ${
                    t.vsPar < 0 ? "text-red-500" :
                    t.vsPar === 0 ? "text-zinc-500" :
                    "text-zinc-400"
                  }`}>
                    {t.vsPar === 0 ? "E" : `${t.vsPar > 0 ? "+" : ""}${t.vsPar}`}
                  </p>
                  <p className="text-xs text-zinc-400">#{t.position}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-zinc-400">
        Rankings auto-update every 5 minutes during live tournaments.
      </p>
    </div>
  );
}
