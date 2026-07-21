import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { calculateTeamScore } from "@/lib/scoring";
import { formatDateRange, formatGBP } from "@/lib/ui";
import { toParDisplay, toParClass } from "@/lib/score-colors";
import LeagueChat from "@/components/LeagueChat";
import { TrophyIcon, CrownIcon, ChartBarIcon, TicketIcon, StarIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;

  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!league) notFound();

  // Check membership
  const isMember = user ? league.members.some((m) => m.userId === user.id) : false;
  if (!isMember) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-6 text-center">
          <p className="text-lg font-semibold text-red-700">Not a member</p>
          <p className="mt-1 text-sm text-red-600">You are not in this league.</p>
          <Link href="/leagues" className="mt-4 inline-block text-sm font-bold text-[#0a3d2a] hover:underline">
            ← Back to Leagues
          </Link>
        </div>
      </div>
    );
  }

  // Get all tournaments that have teams from league members
  const memberUserIds = league.members.map((m) => m.userId);

  const teams = await prisma.team.findMany({
    where: { userId: { in: memberUserIds } },
    include: {
      tournament: true,
      user: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Group teams by tournament
  const teamsByTournament: Record<string, {
    tournament: typeof teams[0]["tournament"];
    teams: typeof teams;
  }> = {};

  for (const team of teams) {
    const tId = team.tournamentId;
    if (!teamsByTournament[tId]) {
      teamsByTournament[tId] = {
        tournament: team.tournament,
        teams: [],
      };
    }
    teamsByTournament[tId].teams.push(team);
  }

  // Calculate scores for each team in each tournament (for mini-leaderboards)
  const tournamentLeaderboards: Record<string, {
    tournament: typeof teams[0]["tournament"];
    results: Awaited<ReturnType<typeof calculateTeamScore>>[];
  }> = {};

  for (const [tId, data] of Object.entries(teamsByTournament)) {
    const results: Awaited<ReturnType<typeof calculateTeamScore>>[] = [];
    for (const team of data.teams) {
      try {
        const score = await calculateTeamScore(team.id);
        results.push(score);
      } catch {
        // skip
      }
    }
    results.sort((a, b) => a.totalStrokes - b.totalStrokes);
    // Assign positions
    let pos = 1;
    for (let i = 0; i < results.length; i++) {
      if (i > 0 && results[i].totalStrokes === results[i - 1].totalStrokes) {
        results[i].position = results[i - 1].position;
      } else {
        results[i].position = pos;
      }
      pos = i + 1;
    }
    tournamentLeaderboards[tId] = { tournament: data.tournament, results };
  }

  // Sort tournaments by start date desc
  const sortedTournamentIds = Object.entries(tournamentLeaderboards)
    .sort(([, a], [, b]) => b.tournament.startDate.getTime() - a.tournament.startDate.getTime())
    .map(([id]) => id);

  // ===== Build cumulative season standings =====
  // For each member: total entries, total strokes, best position, wins, podiums, avg position
  interface MemberStanding {
    userId: string;
    userName: string;
    entries: number;
    totalStrokes: number;
    scoredEntries: number; // entries with scores
    bestPosition: number | null;
    wins: number;
    podiums: number;
    positions: number[];
  }
  const standingsMap = new Map<string, MemberStanding>();
  for (const m of league.members) {
    standingsMap.set(m.userId, {
      userId: m.userId,
      userName: m.user.name ?? m.user.email ?? "Player",
      entries: 0,
      totalStrokes: 0,
      scoredEntries: 0,
      bestPosition: null,
      wins: 0,
      podiums: 0,
      positions: [],
    });
  }

  for (const tId of sortedTournamentIds) {
    const { results } = tournamentLeaderboards[tId];
    for (const r of results) {
      const team = teamsByTournament[tId]?.teams.find((t) => t.id === r.teamId);
      if (!team) continue;
      const standing = standingsMap.get(team.userId);
      if (!standing) continue;
      standing.entries++;
      if (r.totalStrokes > 0) {
        standing.totalStrokes += r.totalStrokes;
        standing.scoredEntries++;
      }
      if (r.position > 0) {
        standing.positions.push(r.position);
        if (r.position === 1) standing.wins++;
        if (r.position <= 3) standing.podiums++;
        if (standing.bestPosition === null || r.position < standing.bestPosition) {
          standing.bestPosition = r.position;
        }
      }
    }
  }

  // Rank: most wins → most podiums → lowest avg position → most entries
  const seasonStandings = [...standingsMap.values()]
    .filter((s) => s.entries > 0)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.podiums !== a.podiums) return b.podiums - a.podiums;
      const aAvg = a.positions.length > 0 ? a.positions.reduce((x, y) => x + y, 0) / a.positions.length : 999;
      const bAvg = b.positions.length > 0 ? b.positions.reduce((x, y) => x + y, 0) / b.positions.length : 999;
      if (aAvg !== bAvg) return aAvg - bAvg;
      return b.entries - a.entries;
    });

  // Assign season positions
  let seasonPos = 1;
  for (let i = 0; i < seasonStandings.length; i++) {
    if (i > 0) {
      const prev = seasonStandings[i - 1];
      const curr = seasonStandings[i];
      const prevAvg = prev.positions.length > 0 ? prev.positions.reduce((x, y) => x + y, 0) / prev.positions.length : 999;
      const currAvg = curr.positions.length > 0 ? curr.positions.reduce((x, y) => x + y, 0) / curr.positions.length : 999;
      if (prev.wins === curr.wins && prev.podiums === curr.podiums && prevAvg === currAvg) {
        // tie — same position
      } else {
        seasonPos = i + 1;
      }
    }
    (seasonStandings[i] as any).seasonPosition = seasonPos;
  }

  const completedEventCount = sortedTournamentIds.filter((tId) => tournamentLeaderboards[tId].results.length > 0).length;

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Back link */}
      <div className="mb-3">
        <Link href="/leagues" className="text-xs text-zinc-500 hover:text-[#0a3d2a] dark:hover:text-green-400">
          ← Leagues
        </Link>
      </div>

      {/* League header */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a3d2a] via-[#0a3d2a] to-[#1a5c3e] p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{league.name}</h1>
            {league.description && (
              <p className="mt-1 text-sm text-white/70">{league.description}</p>
            )}
            <p className="mt-2 text-xs text-white/55">
              Created {new Date(league.createdAt).toLocaleDateString("en-GB")}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-white/55">Members</p>
            <p className="text-2xl font-extrabold text-[#c8a951]">{league.members.length}</p>
          </div>
        </div>
        {/* Invite code */}
        <div className="mt-3 flex items-center gap-2 border-t border-white/20 pt-3">
          <span className="text-[11px] text-white/55">Invite:</span>
          <code className="rounded-lg bg-white/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[#c8a951]">
            {league.inviteCode}
          </code>
        </div>
      </div>

      {/* ===== Season Standings Table ===== */}
      <section className="mt-5">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <CrownIcon className="h-4 w-4 text-[#c8a951]" />
          Season Standings
        </h2>
        {seasonStandings.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 p-6 text-center">
            <p className="text-sm text-zinc-500">No tournament entries yet. Enter a tournament to get on the board!</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            {/* Desktop table */}
            <table className="hidden w-full text-sm sm:table">
              <thead className="bg-[#0a3d2a] text-white">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">#</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">Player</th>
                  <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">Entries</th>
                  <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">Wins</th>
                  <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">Podiums</th>
                  <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">Best</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {seasonStandings.map((s) => {
                  const pos = (s as any).seasonPosition as number;
                  const isYou = user && s.userId === user.id;
                  return (
                    <tr key={s.userId} className={`transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${isYou ? "bg-[#c8a951]/5" : ""}`}>
                      <td className="px-3 py-2.5">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          pos === 1 ? "bg-[#c8a951] text-[#1a1a1a]" : pos <= 3 ? "bg-[#0a3d2a] text-white" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500"
                        }`}>{pos}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-zinc-900 dark:text-white">{s.userName}{isYou && <span className="ml-1 text-xs text-[#0a3d2a] dark:text-green-400">(you)</span>}</span>
                      </td>
                      <td className="px-2 py-2.5 text-center tabular text-zinc-600 dark:text-zinc-400">{s.entries}</td>
                      <td className="px-2 py-2.5 text-center">
                        {s.wins > 0 ? <span className="font-bold text-[#c8a951]">{s.wins}</span> : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-2 py-2.5 text-center tabular text-zinc-600 dark:text-zinc-400">{s.podiums > 0 ? s.podiums : "—"}</td>
                      <td className="px-2 py-2.5 text-center tabular">
                        {s.bestPosition ? <span className="font-bold text-[#0a3d2a] dark:text-green-400">#{s.bestPosition}</span> : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular font-bold text-[#0a3d2a] dark:text-green-400">{s.totalStrokes > 0 ? s.totalStrokes : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Mobile cards */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 sm:hidden">
              {seasonStandings.map((s) => {
                const pos = (s as any).seasonPosition as number;
                const isYou = user && s.userId === user.id;
                return (
                  <div key={s.userId} className={`flex items-center gap-3 p-3 ${isYou ? "bg-[#c8a951]/5" : ""}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      pos === 1 ? "bg-[#c8a951] text-[#1a1a1a]" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500"
                    }`}>{pos}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{s.userName}</p>
                      <div className="flex gap-3 text-[11px] text-zinc-500">
                        <span>{s.entries} entries</span>
                        {s.wins > 0 && <span className="text-[#c8a951] font-semibold">{s.wins}W</span>}
                        {s.bestPosition && <span>Best #{s.bestPosition}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular text-[#0a3d2a] dark:text-green-400">{s.totalStrokes > 0 ? s.totalStrokes : "—"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {completedEventCount > 0 && (
              <div className="border-t border-zinc-100 dark:border-zinc-800 px-3 py-2 text-center text-[11px] text-zinc-400">
                Across {completedEventCount} {completedEventCount === 1 ? "event" : "events"}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ===== Per-Event Results ===== */}
      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <TicketIcon className="h-4 w-4 text-[#0a3d2a] dark:text-green-400" />
          Event Results
        </h2>

        {sortedTournamentIds.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 p-6 text-center">
            <p className="text-sm text-zinc-500">
              No tournament entries from league members yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedTournamentIds.map((tId) => {
              const { tournament, results } = tournamentLeaderboards[tId];
              const hasResults = results.length > 0;
              return (
                <div key={tId} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                  {/* Tournament header */}
                  <div className="border-b border-zinc-100 dark:border-zinc-800 p-3">
                    <div className="flex items-center justify-between">
                      <Link href={`/tournaments/${tId}/leaderboard`} className="text-sm font-bold text-[#0a3d2a] hover:underline dark:text-green-400">
                        {tournament.name}
                      </Link>
                      <span className="text-[11px] text-zinc-400 tabular">{formatDateRange(tournament.startDate, tournament.endDate)}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{tournament.course ?? "TBD"}</p>
                  </div>
                  {/* Results */}
                  {!hasResults ? (
                    <p className="p-3 text-xs text-zinc-400">No scored entries yet.</p>
                  ) : (
                    <div className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                      {results.map((r) => {
                        const totalPar = tournament.par * 4 * 5;
                        const vsPar = r.totalStrokes - totalPar;
                        const isYou = user && teamsByTournament[tId]?.teams.find((t) => t.id === r.teamId)?.userId === user.id;
                        return (
                          <Link
                            key={r.teamId}
                            href={`/tournaments/${tId}/teams/${r.teamId}`}
                            className={`flex items-center gap-3 px-3 py-2 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${isYou ? "bg-[#c8a951]/5" : ""}`}
                          >
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                              r.position === 1 ? "bg-[#c8a951] text-[#1a1a1a]" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500"
                            }`}>{r.position}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">{r.teamName}</p>
                              <p className="truncate text-[11px] text-zinc-500">{r.ownerName}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold tabular text-[#0a3d2a] dark:text-green-400">{r.totalStrokes}</p>
                              <p className={`text-[11px] font-semibold ${toParClass(vsPar)}`}>{toParDisplay(vsPar)}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* League Chat */}
      <LeagueChat leagueId={league.id} leagueName={league.name} currentUserId={userId} />
    </div>
  );
}
