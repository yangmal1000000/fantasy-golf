import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getTeamsWithScores } from "@/lib/team-scores";
import { majorTheme } from "@/lib/ui";
import { toParClass, toParDisplay } from "@/lib/score-colors";
import { notFound } from "next/navigation";
import Link from "next/link";
import TournamentLeaderboard, { type TournamentPlayerScore } from "./TournamentLeaderboard";
import LeaderboardRefresh from "./LeaderboardRefresh";
import PlayerAvatar from "@/components/PlayerAvatar";
import Flag from "@/components/Flag";
import TierBadge from "@/components/TierBadge";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Leaderboard — Fantasy Golf",
  description: "Tournament leaderboard with live scoring and standings.",
};

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { _count: { select: { teams: true } } },
  });

  if (!tournament) notFound();

  const theme = majorTheme(tournament.id);
  const isLive = tournament.status === "in_progress";
  const canEnter = tournament.status === "entries_open" || tournament.status === "upcoming";
  const potTotal = tournament._count.teams * tournament.entryFee;

  // Use pre-computed team scores (fast — single query, no calculation)
  const teams = await getTeamsWithScores(id);
  const hasFantasyTeams = teams.length > 0 && teams.some((t) => t.position != null && t.position > 0);

  // Fetch PGA scores for display when no fantasy teams (single query)
  const pgaScoresRaw = hasFantasyTeams ? [] : await prisma.score.findMany({
    where: { tournamentId: id },
    include: { player: { select: { name: true, country: true } } },
  });

  // Build PGA leaderboard
  const pgaLeaderboard: TournamentPlayerScore[] = [];
  if (pgaScoresRaw.length > 0) {
    const pgaMap = new Map<string, TournamentPlayerScore>();
    for (const s of pgaScoresRaw) {
      if (!pgaMap.has(s.playerId)) {
        pgaMap.set(s.playerId, {
          playerId: s.playerId, playerName: s.player.name, country: s.player.country,
          rounds: [null, null, null, null], total: 0, toPar: 0, roundsPlayed: 0, madeCut: true, position: 0,
        });
      }
      if (s.strokes !== null) pgaMap.get(s.playerId)!.rounds[s.round - 1] = s.strokes;
    }
    const par = tournament.par;
    for (const p of pgaMap.values()) {
      p.roundsPlayed = p.rounds.filter((r): r is number => r !== null).length;
      p.total = p.rounds.filter((r): r is number => r !== null).reduce((a, b) => a + b, 0);
      p.toPar = p.total - par * p.roundsPlayed;
      p.madeCut = p.roundsPlayed >= 3;
      pgaLeaderboard.push(p);
    }
    pgaLeaderboard.sort((a, b) => a.total - b.total);
    let pos = 1;
    for (let i = 0; i < pgaLeaderboard.length; i++) {
      if (i > 0 && pgaLeaderboard[i].total !== pgaLeaderboard[i - 1].total) pos = i + 1;
      pgaLeaderboard[i].position = pos;
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Header */}
      <div className="mb-3">
        <Link href="/tournaments" className="text-xs text-zinc-500 hover:text-[#0a3d2a] dark:hover:text-green-400">← Tournaments</Link>
        <div className="flex items-center gap-2 mt-1">
          <h1 className="text-lg font-bold text-[#0a3d2a] dark:text-green-400 sm:text-xl">Leaderboard</h1>
          {theme && <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${theme.badgeClass}`}>{theme.name}</span>}
        </div>
        <p className="text-xs text-zinc-500">{tournament.name}</p>
      </div>

      {/* Stats bar */}
      <div className="mb-3 grid grid-cols-3 gap-1.5 sm:gap-2">
        <div className={`rounded-lg border bg-white dark:bg-zinc-900 p-2 text-center ${theme ? theme.borderAccent : "border-zinc-200 dark:border-zinc-800"}`}>
          <p className={`text-base font-bold tabular sm:text-lg ${theme ? theme.statsAccent : "text-[#0a3d2a] dark:text-green-400"}`}>{tournament._count.teams}</p>
          <p className="text-[10px] text-zinc-500">Teams</p>
        </div>
        <div className={`rounded-lg border bg-white dark:bg-zinc-900 p-2 text-center ${theme ? theme.borderAccent : "border-zinc-200 dark:border-zinc-800"}`}>
          <p className="text-base font-bold tabular text-[#c8a951] sm:text-lg">{potTotal > 0 ? `$${(potTotal / 100).toFixed(0)}` : "—"}</p>
          <p className="text-[10px] text-zinc-500">Total Pot</p>
        </div>
        <div className={`rounded-lg border bg-white dark:bg-zinc-900 p-2 text-center ${theme ? theme.borderAccent : "border-zinc-200 dark:border-zinc-800"}`}>
          <p className={`text-base font-bold tabular sm:text-lg ${theme ? theme.statsAccent : "text-[#1a5c3e]"}`}>{tournament.par}</p>
          <p className="text-[10px] text-zinc-500">Par</p>
        </div>
      </div>

      {isLive && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 dark:bg-orange-950/30 dark:border-orange-700">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
          </span>
          <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
            LIVE · Round {tournament.currentRound} · Auto-refreshing
          </span>
        </div>
      )}

      {/* Fantasy team standings (pre-computed, fast) */}
      {hasFantasyTeams ? (
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-md">
          <table className="hidden w-full text-sm sm:table">
            <thead className={`${theme ? theme.tableHeaderBg : "bg-[#0a3d2a]"} ${theme ? theme.tableHeaderText : "text-white"}`}>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Pos</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Team</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">Players</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">vs Par</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {teams.map((team) => {
                const totalPar = tournament.par * 4 * 5;
                const vsPar = team.totalScore - totalPar;
                return (
                  <tr key={team.id} className="transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        team.position === 1
                          ? (theme ? theme.positionFirst : "bg-[#c8a951] text-[#1a1a1a]")
                          : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                      }`}>{team.position}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/tournaments/${id}/teams/${team.id}`} className="font-semibold text-[#0a3d2a] hover:underline dark:text-green-400">
                        {team.name}
                      </Link>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{team.user.name ?? team.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-center gap-2">
                        {team.selections.map((sel) => (
                          <div key={sel.id} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1" title={sel.tournamentPlayer.player.name}>
                            <PlayerAvatar name={sel.tournamentPlayer.player.name} country={sel.tournamentPlayer.player.country} photoUrl={sel.tournamentPlayer.player.photoUrl} size="sm" />
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1">
                                <Flag countryCode={sel.tournamentPlayer.player.country} size="sm" />
                                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                  {sel.tournamentPlayer.player.name.split(" ").slice(-1)[0]?.slice(0, 3)}
                                </span>
                              </div>
                              <TierBadge tier={sel.tournamentPlayer.tier} size="sm" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-base font-bold tabular text-[#0a3d2a] dark:text-green-400">{team.totalScore}</td>
                    <td className={`px-4 py-3 text-right text-sm ${toParClass(vsPar)}`}>{toParDisplay(vsPar)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Mobile cards */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 sm:hidden">
            {teams.map((team) => {
              const totalPar = tournament.par * 4 * 5;
              const vsPar = team.totalScore - totalPar;
              return (
                <Link key={team.id} href={`/tournaments/${id}/teams/${team.id}`} className="block p-3 transition active:bg-zinc-50 dark:active:bg-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      team.position === 1 ? (theme ? theme.positionFirst : "bg-[#c8a951] text-[#1a1a1a]") : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                    }`}>{team.position}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#0a3d2a] dark:text-green-400">{team.name}</p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{team.user.name ?? team.user.email}</p>
                      <div className="mt-1 flex gap-1 overflow-x-auto no-scrollbar">
                        {team.selections.map((sel) => (
                          <span key={sel.id} className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5">
                            <PlayerAvatar name={sel.tournamentPlayer.player.name} country={sel.tournamentPlayer.player.country} photoUrl={sel.tournamentPlayer.player.photoUrl} size="sm" />
                            <TierBadge tier={sel.tournamentPlayer.tier} size="sm" />
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold tabular text-[#0a3d2a] dark:text-green-400">{team.totalScore}</p>
                      <p className={`text-xs font-semibold ${toParClass(vsPar)}`}>{toParDisplay(vsPar)}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : pgaLeaderboard.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-12 text-center">
          <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">No teams yet</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Scores will appear here once the tournament begins.</p>
          {canEnter && (
            <Link href={`/tournaments/${id}/enter`} className="mt-4 inline-block rounded-full bg-[#0a3d2a] px-6 py-2 text-sm font-bold text-white hover:bg-[#1a5c3e]">Enter Team →</Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {canEnter && (
            <div className="flex items-center justify-between rounded-xl border border-[#0a3d2a]/20 bg-[#0a3d2a]/5 dark:bg-green-950/20 px-4 py-2.5">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">No fantasy teams entered yet — showing live PGA Tour scores.</p>
              <Link href={`/tournaments/${id}/enter`} className="shrink-0 rounded-full bg-[#0a3d2a] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#1a5c3e]">Enter Team →</Link>
            </div>
          )}
          <TournamentLeaderboard players={pgaLeaderboard} par={tournament.par} theme={theme} />
        </div>
      )}

      {/* Auto-refresh for live tournaments */}
      {isLive && <LeaderboardRefresh />}
    </div>
  );
}
