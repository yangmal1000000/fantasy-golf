import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateTeamScore } from "@/lib/scoring";
import { TIER_CONFIG, TIER_ORDER, formatDateRange } from "@/lib/ui";
import { toParDisplay, toParClass } from "@/lib/score-colors";
import TierBadge from "@/components/TierBadge";
import PlayerAvatar from "@/components/PlayerAvatar";
import Sparkline from "@/components/Sparkline";
import SignInPrompt from "@/components/SignInPrompt";
import { Suspense } from "react";
import { TournamentListSkeleton } from "@/components/Skeletons";
import {
  ChartBarIcon,
  CrownIcon,
  MedalIcon,
  TargetIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  TicketIcon,
  FireIcon,
  StarIcon,
  GolferIcon,
} from "@/components/icons";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Season Stats — Fantasy Golf",
  description: "Your season-long performance, trends, and player analytics.",
};

interface EventResult {
  teamId: string;
  teamName: string;
  tournamentId: string;
  tournamentName: string;
  course: string | null;
  startDate: Date;
  par: number;
  status: string;
  position: number;
  totalStrokes: number;
  vsPar: number;
  category: string;
}

interface TierStat {
  tier: string;
  picks: number;
  totalStrokes: number;
  scoredEntries: number;
  avgStrokes: number;
  bestPlayer: { name: string; id: string; strokes: number; country: string | null; photoUrl: string | null } | null;
}

interface PlayerPickStat {
  playerId: string;
  name: string;
  country: string | null;
  photoUrl: string | null;
  picks: number;
  totalStrokes: number;
  avgStrokes: number;
  bestFinish: { position: number; tournament: string } | null;
}

export default async function StatsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Suspense fallback={<TournamentListSkeleton />}>
        <SignInPrompt
          title="Season Stats"
          message="Sign in to view your season-long performance, trends, and player analytics."
        />
      </Suspense>
    );
  }

  // Fetch all user teams with tournament info
  const teams = await prisma.team.findMany({
    where: { userId: user.id },
    include: {
      tournament: { select: { id: true, name: true, course: true, startDate: true, endDate: true, par: true, status: true, category: true } },
      selections: {
        include: {
          tournamentPlayer: {
            include: { player: { select: { id: true, name: true, country: true, photoUrl: true } } },
          },
        },
      },
    },
    orderBy: { tournament: { startDate: "asc" } },
  });

  // Calculate scores for each team
  const teamScores = await Promise.all(
    teams.map(async (team) => {
      let score: Awaited<ReturnType<typeof calculateTeamScore>> | null = null;
      try {
        score = await calculateTeamScore(team.id);
      } catch {}
      return { team, score };
    })
  );

  // ===== Build event results (only teams with scores > 0) =====
  const eventResults: EventResult[] = [];
  for (const { team, score } of teamScores) {
    if (!score || score.totalStrokes === 0) continue;
    const t = team.tournament;
    const totalPar = t.par * 4 * 5;
    eventResults.push({
      teamId: team.id,
      teamName: team.name,
      tournamentId: t.id,
      tournamentName: t.name,
      course: t.course,
      startDate: t.startDate,
      par: t.par,
      status: t.status,
      position: score.position,
      totalStrokes: score.totalStrokes,
      vsPar: score.totalStrokes - totalPar,
      category: t.category,
    });
  }

  // Sort by date ascending
  eventResults.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // ===== Season Summary Stats =====
  const totalEvents = eventResults.length;
  const totalStrokes = eventResults.reduce((sum, e) => sum + e.totalStrokes, 0);
  const avgStrokesPerEvent = totalEvents > 0 ? Math.round(totalStrokes / totalEvents) : 0;
  const positions = eventResults.map((e) => e.position).filter((p) => p > 0);
  const wins = positions.filter((p) => p === 1).length;
  const podiums = positions.filter((p) => p <= 3).length;
  const top10s = positions.filter((p) => p <= 10).length;
  const avgPosition = positions.length > 0 ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10 : 0;
  const bestPosition = positions.length > 0 ? Math.min(...positions) : null;
  const winRate = totalEvents > 0 ? Math.round((wins / totalEvents) * 100) : 0;
  const podiumRate = totalEvents > 0 ? Math.round((podiums / totalEvents) * 100) : 0;

  // Scoring trend data
  const strokeTrend = eventResults.map((e) => e.totalStrokes);
  const vsParTrend = eventResults.map((e) => e.vsPar);

  // Best and worst events
  const bestEvent = eventResults.length > 0
    ? [...eventResults].sort((a, b) => a.totalStrokes - b.totalStrokes)[0]
    : null;
  const worstEvent = eventResults.length > 0
    ? [...eventResults].sort((a, b) => b.totalStrokes - a.totalStrokes)[0]
    : null;

  // ===== Tier Analysis =====
  const tierMap = new Map<string, { picks: number; totalStrokes: number; scoredEntries: number; players: Map<string, { name: string; id: string; strokes: number; country: string | null; photoUrl: string | null; count: number }> }>();

  for (const { team, score } of teamScores) {
    if (!score || score.totalStrokes === 0) continue;
    for (const p of score.players) {
      if (!tierMap.has(p.tier)) {
        tierMap.set(p.tier, { picks: 0, totalStrokes: 0, scoredEntries: 0, players: new Map() });
      }
      const ts = tierMap.get(p.tier)!;
      ts.picks++;
      ts.totalStrokes += p.totalStrokes;
      ts.scoredEntries++;

      const playerKey = p.playerId;
      const existing = ts.players.get(playerKey);
      if (existing) {
        existing.strokes += p.totalStrokes;
        existing.count++;
      } else {
        ts.players.set(playerKey, {
          name: p.playerName,
          id: p.playerId,
          strokes: p.totalStrokes,
          country: p.country,
          photoUrl: p.photoUrl,
          count: 1,
        });
      }
    }
  }

  const tierStats: TierStat[] = TIER_ORDER
    .filter((tier) => tierMap.has(tier))
    .map((tier) => {
      const ts = tierMap.get(tier)!;
      const players = [...ts.players.values()].sort((a, b) => a.strokes / a.count - b.strokes / b.count);
      return {
        tier,
        picks: ts.picks,
        totalStrokes: ts.totalStrokes,
        scoredEntries: ts.scoredEntries,
        avgStrokes: ts.scoredEntries > 0 ? Math.round(ts.totalStrokes / ts.scoredEntries) : 0,
        bestPlayer: players[0] ? { ...players[0], strokes: Math.round(players[0].strokes / players[0].count) } : null,
      };
    });

  // ===== Player Pick Analysis =====
  const playerMap = new Map<string, PlayerPickStat>();
  for (const { team, score } of teamScores) {
    if (!score) continue;
    for (const sel of team.selections) {
      const p = sel.tournamentPlayer.player;
      const existing = playerMap.get(p.id);
      if (existing) {
        existing.picks++;
      } else {
        playerMap.set(p.id, {
          playerId: p.id,
          name: p.name,
          country: p.country,
          photoUrl: p.photoUrl,
          picks: 1,
          totalStrokes: 0,
          avgStrokes: 0,
          bestFinish: null,
        });
      }
    }
  }

  // Add scoring data per player
  for (const { score } of teamScores) {
    if (!score || score.totalStrokes === 0) continue;
    for (const p of score.players) {
      const stat = playerMap.get(p.playerId);
      if (stat) {
        stat.totalStrokes += p.totalStrokes;
      }
    }
  }

  // Calculate averages and best finishes
  for (const stat of playerMap.values()) {
    const scoredPicks = teamScores.filter(({ score }) => score?.players.some((p) => p.playerId === stat.playerId)).length;
    stat.avgStrokes = scoredPicks > 0 ? Math.round(stat.totalStrokes / scoredPicks) : 0;
  }

  const topPickedPlayers = [...playerMap.values()].sort((a, b) => b.picks - a.picks).slice(0, 8);
  const bestValuePlayers = [...playerMap.values()]
    .filter((p) => p.avgStrokes > 0)
    .sort((a, b) => a.avgStrokes - b.avgStrokes)
    .slice(0, 8);

  // ===== Form Streak (last 5 events) =====
  const last5 = eventResults.slice(-5);
  const last5AvgPos = last5.length > 0 ? Math.round((last5.reduce((s, e) => s + e.position, 0) / last5.length) * 10) / 10 : null;
  const firstHalf = eventResults.slice(0, Math.max(1, Math.floor(eventResults.length / 2)));
  const firstHalfAvgPos = firstHalf.length > 0 ? firstHalf.reduce((s, e) => s + e.position, 0) / firstHalf.length : 0;
  const improving = last5AvgPos !== null && firstHalfAvgPos > 0 && last5AvgPos < firstHalfAvgPos;

  if (totalEvents === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <ChartBarIcon className="mx-auto h-12 w-12 text-zinc-300" />
          <h2 className="mt-3 text-lg font-bold text-zinc-700 dark:text-zinc-300">No completed events yet</h2>
          <p className="mt-1 text-sm text-zinc-500">Enter a tournament and wait for scores to see your season stats here.</p>
          <Link href="/tournaments" className="mt-4 inline-block rounded-lg bg-[#0a3d2a] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0a3d2a]/90">
            Browse Tournaments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      {/* ===== Header ===== */}
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
          <ChartBarIcon className="h-6 w-6 text-[#0a3d2a] dark:text-green-400" />
          Season Stats
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">Your full-season performance analytics</p>
      </div>

      {/* ===== Summary Stat Cards ===== */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <SummaryCard
          icon={<TicketIcon className="h-4 w-4" />}
          label="Events"
          value={totalEvents.toString()}
          sub={`${wins}W · ${podiums}P`}
          accent="text-[#0a3d2a] dark:text-green-400"
        />
        <SummaryCard
          icon={<CrownIcon className="h-4 w-4" />}
          label="Avg Finish"
          value={`#${avgPosition}`}
          sub={bestPosition ? `Best #${bestPosition}` : undefined}
          accent="text-[#c8a951]"
        />
        <SummaryCard
          icon={<ChartBarIcon className="h-4 w-4" />}
          label="Avg Score"
          value={avgStrokesPerEvent > 0 ? avgStrokesPerEvent.toString() : "—"}
          sub={`${totalStrokes} total`}
          accent="text-[#0a3d2a] dark:text-green-400"
        />
        <SummaryCard
          icon={<MedalIcon className="h-4 w-4" />}
          label="Win Rate"
          value={`${winRate}%`}
          sub={`${podiumRate}% podium`}
          accent="text-[#c8a951]"
        />
      </div>

      {/* ===== Scoring Trend ===== */}
      <section className="mt-5">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {improving ? (
                <TrendingUpIcon className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDownIcon className="h-4 w-4 text-zinc-400" />
              )}
              Scoring Trend
            </h2>
            {improving !== null && totalEvents >= 4 && (
              <span className={`flex items-center gap-1 text-xs font-semibold ${improving ? "text-green-600 dark:text-green-400" : "text-zinc-400"}`}>
                {improving ? "Improving" : "Steady"}
              </span>
            )}
          </div>
          {/* Large sparkline */}
          <div className="flex items-end justify-between gap-2">
            {eventResults.length > 1 && (
              <div className="flex-1">
                <Sparkline scores={strokeTrend} width={300} height={50} />
              </div>
            )}
            <div className="text-right shrink-0">
              <p className="text-[11px] text-zinc-400">Last 5 avg pos</p>
              <p className="text-lg font-bold tabular text-[#0a3d2a] dark:text-green-400">
                {last5AvgPos ? `#${last5AvgPos}` : "—"}
              </p>
            </div>
          </div>
          {/* Per-event mini bars */}
          {eventResults.length > 0 && (
            <div className="mt-4 flex items-end gap-1.5 sm:gap-2">
              {eventResults.map((e, i) => {
                const max = Math.max(...strokeTrend);
                const min = Math.min(...strokeTrend);
                const range = max - min || 1;
                const heightPct = 30 + ((max - e.totalStrokes) / range) * 70;
                const isBest = e.totalStrokes === min;
                const isWorst = e.totalStrokes === max;
                return (
                  <Link
                    key={e.teamId}
                    href={`/tournaments/${e.tournamentId}/teams/${e.teamId}`}
                    className="group flex flex-1 flex-col items-center gap-1"
                    title={`${e.tournamentName}: ${e.totalStrokes} (#${e.position})`}
                  >
                    <span className={`text-[9px] font-bold tabular ${isBest ? "text-green-600 dark:text-green-400" : isWorst ? "text-red-500" : "text-zinc-400"}`}>
                      {e.totalStrokes}
                    </span>
                    <div
                      className={`w-full rounded-t transition group-hover:opacity-80 ${
                        isBest ? "bg-green-500 dark:bg-green-600" : isWorst ? "bg-red-400 dark:bg-red-500" : "bg-[#0a3d2a] dark:bg-green-700"
                      }`}
                      style={{ height: `${heightPct}px` }}
                    />
                    <span className="text-[8px] text-zinc-400 tabular">#{e.position}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ===== Best/Worst ===== */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {bestEvent && (
          <Link
            href={`/tournaments/${bestEvent.tournamentId}/teams/${bestEvent.teamId}`}
            className="flex items-center gap-3 rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/20 p-3 transition hover:shadow-md"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
              <TrendingUpIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">Best Score</p>
              <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{bestEvent.tournamentName}</p>
              <p className="text-xs text-zinc-500">
                {bestEvent.totalStrokes} ({toParDisplay(bestEvent.vsPar)}) · #{bestEvent.position}
              </p>
            </div>
          </Link>
        )}
        {worstEvent && worstEvent.teamId !== bestEvent?.teamId && (
          <Link
            href={`/tournaments/${worstEvent.tournamentId}/teams/${worstEvent.teamId}`}
            className="flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-3 transition hover:shadow-md"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-400 text-white dark:bg-red-500">
              <TrendingDownIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">Toughest Event</p>
              <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{worstEvent.tournamentName}</p>
              <p className="text-xs text-zinc-500">
                {worstEvent.totalStrokes} ({toParDisplay(worstEvent.vsPar)}) · #{worstEvent.position}
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* ===== Per-Event Breakdown Table ===== */}
      <section className="mt-5">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <TicketIcon className="h-3.5 w-3.5 text-[#0a3d2a] dark:text-green-400" />
          Event Breakdown
        </h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          {/* Desktop table */}
          <table className="hidden w-full text-sm sm:table">
            <thead className="bg-[#0a3d2a] text-white">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">Event</th>
                <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">Pos</th>
                <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">Score</th>
                <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide">vs Par</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {[...eventResults].reverse().map((e) => {
                const isWin = e.position === 1;
                const isPodium = e.position <= 3;
                return (
                  <tr key={e.teamId} className="transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-3 py-2.5">
                      <Link href={`/tournaments/${e.tournamentId}/teams/${e.teamId}`} className="font-bold text-zinc-900 hover:text-[#0a3d2a] dark:text-white dark:hover:text-green-400">
                        {e.tournamentName}
                      </Link>
                      <p className="text-[11px] text-zinc-400">{e.course}</p>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        isWin ? "bg-[#c8a951] text-[#1a1a1a]" : isPodium ? "bg-[#0a3d2a] text-white" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500"
                      }`}>
                        {e.position}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center font-bold tabular text-[#0a3d2a] dark:text-green-400">{e.totalStrokes}</td>
                    <td className={`px-2 py-2.5 text-center font-semibold ${toParClass(e.vsPar)}`}>{toParDisplay(e.vsPar)}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-zinc-400 tabular">
                      {new Date(e.startDate).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Mobile cards */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 sm:hidden">
            {[...eventResults].reverse().map((e) => {
              const isWin = e.position === 1;
              const isPodium = e.position <= 3;
              return (
                <Link
                  key={e.teamId}
                  href={`/tournaments/${e.tournamentId}/teams/${e.teamId}`}
                  className="flex items-center gap-3 p-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isWin ? "bg-[#c8a951] text-[#1a1a1a]" : isPodium ? "bg-[#0a3d2a] text-white" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500"
                  }`}>
                    {e.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{e.tournamentName}</p>
                    <p className="text-[11px] text-zinc-400">{e.course}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular text-[#0a3d2a] dark:text-green-400">{e.totalStrokes}</p>
                    <p className={`text-[11px] font-semibold ${toParClass(e.vsPar)}`}>{toParDisplay(e.vsPar)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== Tier Performance ===== */}
      {tierStats.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <TargetIcon className="h-3.5 w-3.5 text-purple-500" />
            Tier Performance
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            {tierStats.map((ts) => {
              const config = TIER_CONFIG[ts.tier];
              return (
                <div key={ts.tier} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <TierBadge tier={ts.tier} size="sm" />
                    <span className="text-xs text-zinc-400">{ts.picks} {ts.picks === 1 ? "pick" : "picks"}</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-3">
                    <div>
                      <p className="text-[10px] uppercase text-zinc-400">Avg Strokes</p>
                      <p className="text-lg font-bold tabular text-[#0a3d2a] dark:text-green-400">{ts.avgStrokes}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-zinc-400">Total</p>
                      <p className="text-sm font-semibold tabular text-zinc-600 dark:text-zinc-400">{ts.totalStrokes}</p>
                    </div>
                  </div>
                  {ts.bestPlayer && (
                    <div className="mt-2 flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-2">
                      <PlayerAvatar name={ts.bestPlayer.name} country={ts.bestPlayer.country} photoUrl={ts.bestPlayer.photoUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase text-zinc-400">Best Value</p>
                        <Link
                          href={`/players/${ts.bestPlayer.id}`}
                          className="truncate text-xs font-semibold text-zinc-800 hover:text-[#0a3d2a] dark:text-zinc-200 dark:hover:text-green-400"
                        >
                          {ts.bestPlayer.name}
                        </Link>
                      </div>
                      <span className="text-xs font-bold tabular text-green-600 dark:text-green-400">{ts.bestPlayer.strokes}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== Player Analysis ===== */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {/* Most Picked */}
        {topPickedPlayers.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <StarIcon className="h-3.5 w-3.5 text-[#c8a951]" />
              Most Picked
            </h2>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
              <div className="space-y-2">
                {topPickedPlayers.map((p, i) => (
                  <div key={p.playerId} className="flex items-center gap-2.5">
                    <span className="w-4 text-right text-xs font-bold tabular text-zinc-400">{i + 1}</span>
                    <PlayerAvatar name={p.name} country={p.country} photoUrl={p.photoUrl} size="sm" />
                    <Link
                      href={`/players/${p.playerId}`}
                      className="flex-1 truncate text-sm font-medium text-zinc-800 hover:text-[#0a3d2a] dark:text-zinc-200 dark:hover:text-green-400"
                    >
                      {p.name}
                    </Link>
                    {p.avgStrokes > 0 && (
                      <span className="text-xs tabular text-zinc-400">{p.avgStrokes} avg</span>
                    )}
                    <span className="rounded-full bg-[#c8a951]/15 px-2 py-0.5 text-xs font-bold tabular text-[#c8a951]">
                      {p.picks}×
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Best Value */}
        {bestValuePlayers.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <FireIcon className="h-3.5 w-3.5 text-orange-500" />
              Best Value
            </h2>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
              <div className="space-y-2">
                {bestValuePlayers.map((p, i) => (
                  <div key={p.playerId} className="flex items-center gap-2.5">
                    <span className="w-4 text-right text-xs font-bold tabular text-zinc-400">{i + 1}</span>
                    <PlayerAvatar name={p.name} country={p.country} photoUrl={p.photoUrl} size="sm" />
                    <Link
                      href={`/players/${p.playerId}`}
                      className="flex-1 truncate text-sm font-medium text-zinc-800 hover:text-[#0a3d2a] dark:text-zinc-200 dark:hover:text-green-400"
                    >
                      {p.name}
                    </Link>
                    <span className="text-xs text-zinc-400">{p.picks}× picked</span>
                    <span className="rounded-full bg-green-100 dark:bg-green-950/40 px-2 py-0.5 text-xs font-bold tabular text-green-700 dark:text-green-400">
                      {p.avgStrokes}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ===== Position Distribution ===== */}
      {positions.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <GolferIcon className="h-3.5 w-3.5 text-[#0a3d2a] dark:text-green-400" />
            Finish Distribution
          </h2>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-end justify-between gap-2">
              {/* Win */}
              <DistBar label="Win" count={wins} total={totalEvents} color="bg-[#c8a951]" />
              {/* Podium */}
              <DistBar label="Podium" count={podiums} total={totalEvents} color="bg-[#0a3d2a] dark:bg-green-700" />
              {/* Top 10 */}
              <DistBar label="Top 10" count={top10s} total={totalEvents} color="bg-[#1a5c3e] dark:bg-green-600" />
              {/* Outside Top 10 */}
              <DistBar label="Outside" count={Math.max(0, totalEvents - top10s)} total={totalEvents} color="bg-zinc-300 dark:bg-zinc-600" />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-center shadow-sm">
      <div className={`mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 ${accent}`}>
        {icon}
      </div>
      <p className={`text-lg font-bold tabular sm:text-xl ${accent}`}>{value}</p>
      <p className="text-[10px] font-medium text-zinc-500">{label}</p>
      {sub && <p className="text-[9px] text-zinc-400">{sub}</p>}
    </div>
  );
}

function DistBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const heightPct = Math.max(8, pct);
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span className="text-sm font-bold tabular text-zinc-700 dark:text-zinc-300">{count}</span>
      <div className="flex h-20 w-full items-end overflow-hidden rounded-t bg-zinc-100 dark:bg-zinc-800">
        <div className={`w-full ${color} rounded-t transition-all`} style={{ height: `${heightPct}%` }} />
      </div>
      <span className="text-[10px] font-medium text-zinc-500">{label}</span>
      <span className="text-[9px] text-zinc-400">{pct}%</span>
    </div>
  );
}
