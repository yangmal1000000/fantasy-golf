import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  TIER_CONFIG,
} from "@/lib/ui";
import { roundScoreClass, toParClass, toParDisplay } from "@/lib/score-colors";
import TierBadge from "@/components/TierBadge";
import PlayerAvatar from "@/components/PlayerAvatar";
import Flag from "@/components/Flag";
import Sparkline from "@/components/Sparkline";
import { GolferIcon, ChartBarIcon, MoneyIcon, StarIcon, TrendingUpIcon, BoltIcon, FinishFlagIcon, TargetIcon, TrophyIcon, IconByName } from "@/components/icons";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Player Profile — Fantasy Golf",
  description: "View player stats, season averages, recent results, and fantasy impact.",
};

/* ───────────────────────── helpers ───────────────────────── */

function positionColor(pos: number): string {
  if (pos === 1) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (pos <= 5) return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  if (pos <= 10) return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  if (pos <= 20) return "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
}

function formColor(pos: number | null, madeCut: boolean | null): string {
  if (pos == null) return "#94a3b8";
  if (madeCut === false) return "#dc2626";
  if (pos === 1) return "#f59e0b";
  if (pos <= 5) return "#16a34a";
  if (pos <= 10) return "#3b82f6";
  if (pos <= 20) return "#14b8a6";
  return "#94a3b8";
}

/* ───────────────────────── page ───────────────────────── */

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const player = await prisma.player.findUnique({
    where: { id },
    include: {
      tournaments: {
        include: {
          tournament: true,
          selections: { include: { team: { select: { id: true, name: true, position: true, tournamentId: true } } } },
        },
      },
      scores: {
        include: { tournament: true },
        orderBy: [{ tournamentId: "asc" }, { round: "asc" }],
      },
    },
  });

  if (!player) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center sm:py-24">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#0a3d2a]/10">
          <GolferIcon className="h-10 w-10 text-[#0a3d2a]" />
        </div>
        <h1 className="text-2xl font-bold text-[#0a3d2a] dark:text-green-400 sm:text-3xl">
          Player not found
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          We couldn&apos;t find that player. They may not be in the database yet,
          or the link may be outdated.
        </p>
        <Link
          href="/players"
          className="mt-6 inline-block rounded-full bg-[#0a3d2a] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#1a5c3e] touch-target"
        >
          ← Back to Player Rankings
        </Link>
      </div>
    );
  }

  /* ── Group scores by tournament ── */
  const scoresByTournament: Record<
    string,
    {
      tournament: (typeof player.scores)[number]["tournament"];
      rounds: (number | null)[];
    }
  > = {};

  for (const score of player.scores) {
    if (!scoresByTournament[score.tournamentId]) {
      scoresByTournament[score.tournamentId] = {
        tournament: score.tournament,
        rounds: [null, null, null, null],
      };
    }
    if (score.round >= 1 && score.round <= 4) {
      scoresByTournament[score.tournamentId].rounds[score.round - 1] = score.strokes;
    }
  }

  /* ── Get all scores for tournaments this player entered (to compute positions) ── */
  const tournamentIds = player.tournaments.map((tp) => tp.tournamentId);

  const [allPeerScores, allPeerTPs] = await Promise.all([
    prisma.score.findMany({
      where: { tournamentId: { in: tournamentIds }, strokes: { not: null } },
      select: { playerId: true, tournamentId: true, round: true, strokes: true },
    }),
    prisma.tournamentPlayer.findMany({
      where: { tournamentId: { in: tournamentIds } },
      select: { playerId: true, tournamentId: true, tier: true, madeCut: true, withdrew: true },
    }),
  ]);

  // Build tournament positions from all peer scores
  const tpKey = (tid: string, pid: string) => `${tid}:${pid}`;
  const peerTPMap = new Map<string, { madeCut: boolean | null; withdrew: boolean; tier: string }>();
  for (const tp of allPeerTPs) {
    peerTPMap.set(tpKey(tp.tournamentId, tp.playerId), {
      madeCut: tp.madeCut,
      withdrew: tp.withdrew,
      tier: tp.tier,
    });
  }

  // Group peer scores by tournament
  const peerScoresByT = new Map<string, Map<string, { total: number; rounds: number }>>();
  for (const s of allPeerScores) {
    if (s.strokes == null) continue;
    if (!peerScoresByT.has(s.tournamentId)) peerScoresByT.set(s.tournamentId, new Map());
    const inner = peerScoresByT.get(s.tournamentId)!;
    if (!inner.has(s.playerId)) inner.set(s.playerId, { total: 0, rounds: 0 });
    const e = inner.get(s.playerId)!;
    e.total += s.strokes;
    e.rounds += 1;
  }

  // Compute positions per tournament
  const positionsByT = new Map<string, Map<string, number>>();
  for (const [tid, scoreMap] of peerScoresByT) {
    const entries = Array.from(scoreMap.entries()).map(([pid, data]) => {
      const tp = peerTPMap.get(tpKey(tid, pid));
      return {
        pid,
        total: data.total,
        rounds: data.rounds,
        madeCut: tp?.madeCut ?? null,
        withdrew: tp?.withdrew ?? false,
      };
    });
    entries.sort((a, b) => {
      if (a.withdrew !== b.withdrew) return a.withdrew ? 1 : -1;
      if (a.rounds !== b.rounds) return b.rounds - a.rounds;
      return a.total - b.total;
    });
    const posMap = new Map<string, number>();
    entries.forEach((e, i) => posMap.set(e.pid, i + 1));
    positionsByT.set(tid, posMap);
  }

  /* ── Compute player's stats ── */

  // Finishes with positions
  const finishes: {
    tournamentId: string;
    tournamentName: string;
    startDate: Date;
    position: number;
    madeCut: boolean | null;
    par: number;
    rounds: (number | null)[];
    total: number;
    toPar: number;
  }[] = [];

  for (const [tid, data] of Object.entries(scoresByTournament)) {
    const posMap = positionsByT.get(tid);
    const position = posMap?.get(player.id) ?? null;
    const tp = player.tournaments.find((t) => t.tournamentId === tid);
    const par = data.tournament.par;
    const validRounds = data.rounds.filter((r): r is number => r != null);
    const total = validRounds.reduce((a, b) => a + b, 0);
    const toPar = total - par * validRounds.length;

    if (position != null) {
      finishes.push({
        tournamentId: tid,
        tournamentName: data.tournament.name,
        startDate: data.tournament.startDate,
        position,
        madeCut: tp?.madeCut ?? null,
        par,
        rounds: data.rounds,
        total,
        toPar,
      });
    }
  }

  // Sort by date desc for "recent", by position asc for "best"
  const recentFinishes = [...finishes].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  const sortedByPos = [...finishes].sort((a, b) => a.position - b.position);

  const bestFinish = sortedByPos[0]?.position ?? null;
  const worstFinish = sortedByPos[sortedByPos.length - 1]?.position ?? null;
  const avgPosition =
    finishes.length > 0
      ? Math.round((finishes.reduce((s, f) => s + f.position, 0) / finishes.length) * 10) / 10
      : null;

  // Round-by-round averages
  const roundAvgs = [1, 2, 3, 4].map((r) => {
    const scores = player.scores.filter((s) => s.round === r && s.strokes != null).map((s) => s.strokes!);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  });

  const allValidScores = player.scores
    .filter((s) => s.strokes != null)
    .map((s) => ({ strokes: s.strokes!, par: scoresByTournament[s.tournamentId]?.tournament.par ?? 72 }));

  const scoringAverage =
    allValidScores.length > 0
      ? Math.round((allValidScores.reduce((s, sc) => s + sc.strokes, 0) / allValidScores.length) * 10) / 10
      : null;

  const totalStrokes = allValidScores.reduce((s, sc) => s + sc.strokes, 0);
  const roundsUnderPar = allValidScores.filter((sc) => sc.strokes < sc.par).length;

  // Consistency (standard deviation of round scores)
  let consistency: number | null = null;
  if (allValidScores.length > 1) {
    const mean = allValidScores.reduce((s, sc) => s + sc.strokes, 0) / allValidScores.length;
    const variance = allValidScores.reduce((s, sc) => s + Math.pow(sc.strokes - mean, 2), 0) / allValidScores.length;
    consistency = Math.round(Math.sqrt(variance) * 100) / 100;
  }

  // Fast starter or strong finisher?
  const r1Avg = roundAvgs[0];
  const r4Avg = roundAvgs[3];
  let tendency: "Fast Starter" | "Strong Finisher" | "Consistent" | null = null;
  if (r1Avg != null && r4Avg != null) {
    const diff = r1Avg - r4Avg;
    if (diff > 1) tendency = "Fast Starter";
    else if (diff < -1) tendency = "Strong Finisher";
    else tendency = "Consistent";
  }

  // Form (last 5)
  const form = recentFinishes.slice(0, 5).map((f) => ({
    position: f.position,
    madeCut: f.madeCut,
    label: f.position === 1 ? "W" : f.madeCut === false ? "MC" : `${f.position}`,
    color: formColor(f.position, f.madeCut),
    tournamentName: f.tournamentName,
  }));

  /* ── Fantasy Impact ── */
  const totalSelections = player.tournaments.reduce((s, tp) => s + tp.selections.length, 0);

  // Teams with this player and their positions
  const teamPositions: number[] = [];
  for (const tp of player.tournaments) {
    for (const sel of tp.selections) {
      if (sel.team.position != null) teamPositions.push(sel.team.position);
    }
  }
  const teamsWon = teamPositions.filter((p) => p === 1).length;
  const winRate = teamPositions.length > 0 ? (teamsWon / teamPositions.length) * 100 : 0;
  const avgTeamFinish =
    teamPositions.length > 0
      ? Math.round((teamPositions.reduce((a, b) => a + b, 0) / teamPositions.length) * 10) / 10
      : null;

  // Tier value: rank within tier by scoring average
  const playerTier = player.tournaments[0]?.tier ?? "T51_PLUS";
  const sameTierPlayerIds = new Set<string>();
  for (const tp of allPeerTPs) {
    if (tp.tier === playerTier) sameTierPlayerIds.add(tp.playerId);
  }

  // Compute avg score per same-tier player
  const tierScores = new Map<string, number[]>();
  for (const s of allPeerScores) {
    if (s.strokes == null) continue;
    if (!sameTierPlayerIds.has(s.playerId)) continue;
    if (!tierScores.has(s.playerId)) tierScores.set(s.playerId, []);
    tierScores.get(s.playerId)!.push(s.strokes);
  }

  const tierAverages = Array.from(tierScores.entries())
    .map(([pid, scores]) => ({
      pid,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    .sort((a, b) => a.avg - b.avg);

  const tierRank = tierAverages.findIndex((t) => t.pid === player.id) + 1;
  const tierTotal = tierAverages.length;

  /* ── Get tournament-player info map for display ── */
  const tpDisplayMap = new Map(player.tournaments.map((tp) => [tp.tournamentId, tp]));

  /* ───────────────────────── render ───────────────────────── */
  const tierCfg = TIER_CONFIG[playerTier];

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
      {/* Back link */}
      <div className="mb-3 sm:mb-4">
        <Link
          href="/players"
          className="text-sm text-zinc-500 hover:text-[#1a6b3c] dark:text-zinc-400 dark:hover:text-green-400"
        >
          ← Player Rankings
        </Link>
      </div>

      {/* ── Header Card ── */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f3d20] via-[#1a6b3c] to-[#2d8f56] p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          {/* Avatar */}
          <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
            <PlayerAvatar name={player.name} country={player.country} photoUrl={player.photoUrl} size="md" />
          </div>

          {/* Name + details */}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold sm:text-3xl">{player.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
              <Flag countryCode={player.country} size="sm" showName />
              {player.dataGolfRank && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
                  World #{player.dataGolfRank}
                </span>
              )}
              {tierCfg && (
                <span className="inline-flex items-center gap-1">
                  <TierBadge tier={playerTier} size="sm" showLabel />
                </span>
              )}
            </div>

            {/* Form dots */}
            {form.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-white/60">Form:</span>
                <div className="flex items-center gap-1.5">
                  {form.map((f, i) => (
                    <span
                      key={i}
                      title={`${f.tournamentName}: ${f.label}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: f.color }}
                    >
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Key stats row */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <HeaderStat label="Avg Score" value={scoringAverage != null ? scoringAverage.toFixed(1) : "—"} />
          <HeaderStat label="Best Finish" value={bestFinish != null ? String(bestFinish) : "—"} highlight={bestFinish === 1} />
          <HeaderStat label="Selection Rate" value={`${totalSelections} picks`} />
          <HeaderStat label="Teams Won" value={teamsWon.toString()} highlight={teamsWon > 0} />
        </div>
      </div>

      {/* ── Bio Section ── */}
      {player.bio && (
        <div className="mt-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            {player.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.photoUrl}
                alt={player.name}
                className="hidden sm:block h-20 w-20 rounded-xl object-cover shrink-0"
                loading="lazy"
              />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">About</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {player.bio}
              </p>
              {player.birthplace && (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{player.birthplace}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* ── Season Stats ── */}
        <Card title="Season Stats" icon="chart_bar">
          {scoringAverage == null ? (
            <EmptyState text="No scoring data yet." />
          ) : (
            <div className="space-y-3">
              {/* Round averages */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Round Averages
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {roundAvgs.map((avg, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-2 text-center"
                    >
                      <p className="text-xs text-zinc-400">R{i + 1}</p>
                      <p className="text-base font-bold text-zinc-900 dark:text-white">
                        {avg != null ? avg.toFixed(1) : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sparkline of round averages */}
              {roundAvgs.some((a) => a != null) && (
                <div className="flex items-center justify-center gap-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 py-3">
                  <Sparkline
                    scores={roundAvgs}
                    par={72}
                    width={120}
                    height={30}
                  />
                  {tendency && (
                    <span className="text-xs font-semibold text-[#1a6b3c] dark:text-green-400">
                      {tendency}
                    </span>
                  )}
                </div>
              )}

              {/* Stat grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <StatBox label="Scoring Avg" value={scoringAverage.toFixed(1)} />
                <StatBox label="Rounds Under Par" value={roundsUnderPar.toString()} />
                <StatBox label="Total Strokes" value={totalStrokes.toString()} />
                <StatBox label="Best Finish" value={bestFinish?.toString() ?? "—"} />
                <StatBox label="Worst Finish" value={worstFinish?.toString() ?? "—"} />
                <StatBox label="Avg Position" value={avgPosition?.toString() ?? "—"} />
              </div>

              {/* Consistency */}
              {consistency != null && (
                <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Consistency (σ)
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          consistency < 2
                            ? "bg-green-500"
                            : consistency < 3.5
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, (consistency / 5) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {consistency.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ── Fantasy Impact ── */}
        <Card title="Fantasy Impact" icon="money">
          {totalSelections === 0 ? (
            <EmptyState text="No fantasy teams have picked this player yet." />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <StatBox label="Times Picked" value={totalSelections.toString()} />
                <StatBox label="Teams Won" value={teamsWon.toString()} highlight={teamsWon > 0} />
                <StatBox
                  label="Win Rate"
                  value={teamPositions.length > 0 ? `${winRate.toFixed(1)}%` : "—"}
                />
                <StatBox
                  label="Avg Team Finish"
                  value={avgTeamFinish?.toString() ?? "—"}
                />
              </div>

              {/* Tier value */}
              {tierRank > 0 && tierTotal > 0 && (
                <div className="rounded-lg bg-gradient-to-br from-[#0f3d20]/5 to-[#1a6b3c]/5 dark:from-green-900/20 dark:to-green-800/10 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        Tier Value Rank
                      </p>
                      <p className="text-lg font-bold text-[#1a6b3c] dark:text-green-400">
                        #{tierRank}{" "}
                        <span className="text-sm font-normal text-zinc-400">
                          of {tierTotal} in {tierCfg?.short ?? playerTier}
                        </span>
                      </p>
                    </div>
                    {tierRank <= 3 && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 inline-flex items-center gap-1">
                        <StarIcon className="h-3 w-3" /> Top Value
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Teams list */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Recent Selections
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {player.tournaments
                    .filter((tp) => tp.selections.length > 0)
                    .flatMap((tp) =>
                      tp.selections.map((sel) => ({
                        id: sel.id,
                        name: sel.team.name,
                        pos: sel.team.position,
                        tId: tp.tournamentId,
                      })),
                    )
                    .slice(0, 12)
                    .map((sel) => (
                      <Link
                        key={sel.id}
                        href={`/tournaments/${sel.tId}/teams/${sel.id}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition hover:bg-zinc-200 dark:hover:bg-zinc-700 ${
                          sel.pos === 1
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {sel.name}
                        {sel.pos != null && (
                          <span className="text-[10px] text-zinc-400">#{sel.pos}</span>
                        )}
                      </Link>
                    ))}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* ── Round Tendencies ── */}
        <Card title="Round Tendencies" icon="trending_up">
          {scoringAverage == null ? (
            <EmptyState text="No round data yet." />
          ) : (
            <div className="space-y-3">
              {/* Big sparkline */}
              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-4">
                <div className="flex items-center justify-center">
                  <Sparkline scores={roundAvgs} par={72} width={200} height={50} />
                </div>
                <p className="mt-2 text-center text-xs text-zinc-400">
                  Round 1 → Round 4 scoring trend
                </p>
              </div>

              {/* Tendency label */}
              {tendency && (
                <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2.5">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Tendency
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                      tendency === "Fast Starter"
                        ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
                        : tendency === "Strong Finisher"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                    }`}>
                    {tendency === "Fast Starter" ? <BoltIcon className="h-3 w-3" /> : tendency === "Strong Finisher" ? <FinishFlagIcon className="h-3 w-3" /> : <TargetIcon className="h-3 w-3" />}
                    {tendency}
                  </span>
                </div>
              )}

              {/* Per-round breakdown */}
              <div className="grid grid-cols-4 gap-1.5">
                {roundAvgs.map((avg, i) => {
                  const par = 72;
                  const diff = avg != null ? avg - par : null;
                  return (
                    <div key={i} className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-2 text-center">
                      <p className="text-[10px] uppercase text-zinc-400">R{i + 1}</p>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white">
                        {avg != null ? avg.toFixed(1) : "—"}
                      </p>
                      {diff != null && (
                        <p
                          className={`text-[10px] font-medium ${
                            diff < 0
                              ? "text-red-600 dark:text-red-400"
                              : diff > 0
                                ? "text-zinc-800 dark:text-zinc-500"
                                : "text-zinc-400"
                          }`}
                        >
                          {diff === 0 ? "E" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Consistency */}
              {consistency != null && (
                <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Consistency Rating
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      consistency < 2
                        ? "text-red-600 dark:text-red-400"
                        : consistency < 3.5
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-500 dark:text-red-400"
                    }`}
                  >
                    {consistency < 2 ? "Very Consistent" : consistency < 3.5 ? "Moderate" : "Volatile"}{" "}
                    ({consistency.toFixed(2)}σ)
                  </span>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ── Career Summary ── */}
        <Card title="Career Summary" icon="trophy">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatBox label="Tournaments" value={player.tournaments.length.toString()} />
            <StatBox label="Cuts Made" value={
              player.tournaments.filter((tp) => tp.madeCut === true).length.toString()
            } />
            <StatBox label="Cuts Missed" value={
              player.tournaments.filter((tp) => tp.madeCut === false).length.toString()
            } />
            <StatBox label="Best Finish" value={bestFinish?.toString() ?? "—"} highlight={bestFinish === 1} />
            <StatBox label="Avg Finish" value={avgPosition?.toString() ?? "—"} />
            <StatBox label="Total Picks" value={totalSelections.toString()} />
          </div>

          {/* Tier badge */}
          {tierCfg && (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2.5">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Tier
              </span>
              <div className="flex items-center gap-2">
                <TierBadge tier={playerTier} size="md" showLabel />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Recent Results Table ── */}
      <div className="mt-5 sm:mt-6">
        <h2 className="mb-3 text-lg font-bold text-[#0f3d20] dark:text-green-400 sm:mb-4">
          Recent Results
        </h2>

        {recentFinishes.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-6 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No tournament results yet.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <th className="px-3 py-2.5 text-left font-semibold">Tournament</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Pos</th>
                    <th className="px-3 py-2.5 text-center font-semibold">R1</th>
                    <th className="px-3 py-2.5 text-center font-semibold">R2</th>
                    <th className="px-3 py-2.5 text-center font-semibold">R3</th>
                    <th className="px-3 py-2.5 text-center font-semibold">R4</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Total</th>
                    <th className="px-3 py-2.5 text-center font-semibold">To Par</th>
                  </tr>
                </thead>
                <tbody>
                  {recentFinishes.slice(0, 10).map((f) => (
                    <tr
                      key={f.tournamentId}
                      className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                    >
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/tournaments/${f.tournamentId}/leaderboard`}
                          className="font-medium text-zinc-900 hover:text-[#1a6b3c] hover:underline dark:text-white dark:hover:text-green-400"
                        >
                          {f.tournamentName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-md px-1.5 text-xs font-bold ${
                            f.position === 1
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              : positionColor(f.position)
                          }`}
                        >
                          {f.position === 1 ? <TrophyIcon className="inline h-3 w-3" /> : f.position}
                        </span>
                      </td>
                      {f.rounds.map((r, i) => {
                        const diff = r != null ? r - f.par : null;
                        return (
                          <td key={i} className="px-3 py-2.5 text-center">
                            {r != null ? (
                              <span
                                className={`font-medium ${
                                  diff! < 0
                                    ? "text-red-600 dark:text-red-400"
                                    : diff! > 0
                                      ? "text-zinc-800 dark:text-zinc-500"
                                      : "text-zinc-600 dark:text-zinc-300"
                                }`}
                              >
                                {r}
                              </span>
                            ) : (
                              <span className="text-zinc-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center font-bold text-zinc-900 dark:text-white">
                        {f.total || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {f.total ? (
                          <span
                            className={`font-bold ${toParClass(f.toPar)}`}
                          >
                            {toParDisplay(f.toPar)}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 p-2 sm:hidden">
              {recentFinishes.slice(0, 10).map((f) => {
                const tp = tpDisplayMap.get(f.tournamentId);
                return (
                  <div
                    key={f.tournamentId}
                    className={`rounded-xl border p-3 ${
                      f.position === 1
                        ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                        : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/tournaments/${f.tournamentId}/leaderboard`}
                          className="font-bold text-zinc-900 hover:underline dark:text-white text-sm"
                        >
                          {f.tournamentName}
                        </Link>
                        {tp?.tier && (
                          <div className="mt-0.5">
                            <TierBadge tier={tp.tier} size="sm" />
                          </div>
                        )}
                      </div>
                      <span
                        className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-md px-1.5 text-xs font-bold ${
                          f.position === 1
                            ? "bg-amber-200 text-amber-900"
                            : positionColor(f.position)
                        }`}
                      >
                        {f.position === 1 ? <TrophyIcon className="inline h-3 w-3" /> : f.position}
                      </span>
                    </div>
                    {/* Round scores */}
                    <div className="mt-2 grid grid-cols-4 gap-1">
                      {f.rounds.map((r, i) => (
                        <div key={i} className="rounded bg-white/70 dark:bg-zinc-900/50 p-1 text-center">
                          <p className="text-[10px] text-zinc-400">R{i + 1}</p>
                          <p className={`text-sm font-bold ${
                            r != null && r < f.par
                              ? "text-red-600 dark:text-red-400"
                              : r != null && r > f.par
                                ? "text-zinc-800 dark:text-zinc-500"
                                : "text-zinc-600 dark:text-zinc-300"
                          }`}>
                            {r ?? "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        Total: <span className="font-bold text-zinc-700 dark:text-zinc-300">{f.total || "—"}</span>
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          f.toPar < 0
                            ? "text-red-600 dark:text-red-400"
                            : f.toPar > 0
                              ? "text-zinc-800 dark:text-zinc-500"
                              : "text-zinc-500"
                        }`}
                      >
                        {toParDisplay(f.toPar)}
                      </span>
                    </div>
                    {tp?.madeCut === false && (
                      <p className="mt-1 text-xs font-semibold text-orange-600">✗ Missed Cut</p>
                    )}
                    {tp?.withdrew && (
                      <p className="mt-1 text-xs font-semibold text-red-500">WD</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── UI primitives ───────────────────────── */

function HeaderStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur p-3 text-center">
      <p
        className={`text-lg font-bold sm:text-xl ${
          highlight ? "text-amber-300" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-white/60 sm:text-xs">{label}</p>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-white sm:text-lg">
        <IconByName name={icon} className="h-5 w-5 text-[#0a3d2a] dark:text-green-400" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-2.5 text-center">
      <p
        className={`text-base font-bold sm:text-lg ${
          highlight
            ? "text-amber-600 dark:text-amber-400"
            : "text-zinc-900 dark:text-white"
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 sm:text-xs">{label}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/30 py-6 text-center">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{text}</p>
    </div>
  );
}
