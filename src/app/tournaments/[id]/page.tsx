import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatDateRange, STATUS_CONFIG, CATEGORY_CONFIG, courseImage, formatGBP } from "@/lib/ui";
import { MapPinIcon, UsersIcon, PoundIcon, ChartBarIcon, GolfFlagIcon, TrophyIcon, TargetIcon, BoltIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await prisma.tournament.findUnique({ where: { id }, select: { name: true } });
  if (!t) return { title: "Tournament — Fantasy Golf" };
  return { title: `${t.name} — Fantasy Golf`, description: `Tournament details, field, and entry for ${t.name}.` };
}

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      players: {
        include: { player: { select: { id: true, name: true, country: true, dataGolfRank: true } } },
      },
      _count: { select: { teams: true, players: true } },
    },
  });

  if (!tournament) notFound();

  // Fetch scores for this tournament
  const scores = await prisma.score.findMany({
    where: { tournamentId: id, strokes: { not: null } },
    select: { playerId: true, round: true, strokes: true },
  });

  // Build score lookup: playerId -> { round -> strokes, total, toPar, madeCut }
  const par = tournament.par;
  const scoreMap = new Map<string, { rounds: (number|null)[]; total: number; toPar: number; madeCut: boolean; roundsPlayed: number }>();
  for (const s of scores) {
    if (!scoreMap.has(s.playerId)) scoreMap.set(s.playerId, { rounds: [null,null,null,null], total: 0, toPar: 0, madeCut: true, roundsPlayed: 0 });
    const entry = scoreMap.get(s.playerId)!;
    entry.rounds[s.round - 1] = s.strokes;
  }
  for (const [pid, entry] of scoreMap) {
    entry.roundsPlayed = entry.rounds.filter(r => r !== null).length;
    entry.total = entry.rounds.filter((r): r is number => r !== null).reduce((a,b) => a+b, 0);
    entry.toPar = entry.total - par * entry.roundsPlayed;
    entry.madeCut = entry.roundsPlayed >= 3; // Made cut if they played R3
  }
  const hasScores = scores.length > 0;

  const status = STATUS_CONFIG[tournament.status] ?? STATUS_CONFIG.upcoming;
  const cat = CATEGORY_CONFIG[tournament.category];
  const canEnter = tournament.status === "entries_open" || tournament.status === "upcoming";
  const isLive = tournament.status === "in_progress";
  const potValue = tournament.entryFee * tournament._count.teams;

  // Group players by tier
  const tierOrder = ["T1_10", "T11_20", "T21_30", "T31_50", "T51_PLUS"];
  const tierLabels: Record<string, string> = {
    T1_10: "Tier 1 (Ranks 1–10)",
    T11_20: "Tier 2 (Ranks 11–20)",
    T21_30: "Tier 3 (Ranks 21–30)",
    T31_50: "Tier 4 (Ranks 31–50)",
    T51_PLUS: "Tier 5 (Ranks 51+)",
  };
  const playersByTier: Record<string, typeof tournament.players> = {};
  for (const tp of tournament.players) {
    const tier = tp.tier ?? "T51_PLUS";
    if (!playersByTier[tier]) playersByTier[tier] = [];
    playersByTier[tier].push(tp);
  }
  for (const t of tierOrder) {
    if (playersByTier[t]) {
      playersByTier[t].sort((a, b) => (a.player.dataGolfRank ?? 999) - (b.player.dataGolfRank ?? 999));
    }
  }

  const daysUntil = Math.ceil((tournament.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Breadcrumb */}
      <Link href="/tournaments" className="text-xs text-zinc-500 hover:text-[#0a3d2a] dark:hover:text-green-400">← Tournaments</Link>

      {/* Header banner */}
      <div className="relative mt-2 overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={courseImage(tournament.id)} alt={tournament.course || tournament.name} className="h-40 w-full object-cover sm:h-48" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a3d2a]/95 via-[#0a3d2a]/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white sm:p-5">
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${status.badgeClass}`}>{status.label}</span>
            {cat && <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-semibold">{cat.label}</span>}
            {isLive && tournament.currentRound > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-[#c44545] px-2 py-0.5 text-[10px] font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> ROUND {tournament.currentRound}
              </span>
            )}
          </div>
          <h1 className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">{tournament.name}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/90">
            <MapPinIcon className="h-3 w-3" />
            {tournament.course ?? "TBD"} · {formatDateRange(tournament.startDate, tournament.endDate)}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 text-center">
          <p className="text-lg font-bold tabular text-[#0a3d2a] dark:text-green-400">{tournament._count.teams}</p>
          <p className="text-[10px] text-zinc-500">Teams</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 text-center">
          <p className="text-lg font-bold tabular text-[#0a3d2a] dark:text-green-400">{tournament._count.players}</p>
          <p className="text-[10px] text-zinc-500">Players</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 text-center">
          <p className="text-lg font-bold tabular text-[#c8a951]">{formatGBP(tournament.entryFee)}</p>
          <p className="text-[10px] text-zinc-500">Entry</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 text-center">
          <p className="text-lg font-bold tabular text-[#0a3d2a] dark:text-green-400">{tournament.par}</p>
          <p className="text-[10px] text-zinc-500">Par</p>
        </div>
      </div>

      {/* Prize pool + countdown */}
      {potValue > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-[#c8a951]/30 bg-gradient-to-r from-[#c8a951]/10 to-transparent p-3">
          <div className="flex items-center gap-2">
            <TrophyIcon className="h-5 w-5 text-[#c8a951]" />
            <div>
              <p className="text-xs text-zinc-500">Prize Pool</p>
              <p className="text-lg font-bold tabular text-[#c8a951]">£{potValue.toLocaleString()}</p>
            </div>
          </div>
          {canEnter && daysUntil > 0 && (
            <div className="text-right">
              <p className="text-xs text-zinc-500">Starts in</p>
              <p className="text-lg font-bold tabular text-[#0a3d2a] dark:text-green-400">{daysUntil} day{daysUntil === 1 ? "" : "s"}</p>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {canEnter ? (
          <Link href={`/tournaments/${tournament.id}/enter`} className="flex items-center justify-center gap-1.5 rounded-lg bg-[#0a3d2a] dark:bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1a5c3e]">
            <GolfFlagIcon className="h-4 w-4" /> Enter Team
          </Link>
        ) : (
          <div className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-4 py-2.5 text-sm font-bold text-zinc-400">
            Entries Closed
          </div>
        )}
        <Link href={`/tournaments/${tournament.id}/leaderboard`} className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-zinc-300">
          <ChartBarIcon className="h-4 w-4" /> Leaderboard
        </Link>
        <Link href={`/tournaments/${tournament.id}/draft-board`} className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-zinc-300">
          <UsersIcon className="h-4 w-4" /> Draft Board
        </Link>
        <Link href={`/tournaments/${tournament.id}/side-games`} className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-zinc-300">
          <TargetIcon className="h-4 w-4" /> Side Games
        </Link>
      </div>

      {/* Live tracker link for in-progress */}
      {isLive && (
        <Link href={`/tournaments/${tournament.id}/live`} className="mt-2 flex items-center justify-between rounded-lg border border-[#c44545]/30 bg-gradient-to-r from-[#c44545]/10 to-transparent p-3 transition hover:border-[#c44545]/50">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c44545] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#c44545]" />
            </span>
            <span className="text-sm font-bold text-[#c44545]">Live Match Tracker</span>
          </div>
          <span className="text-sm font-bold text-[#c44545]">Follow Live →</span>
        </Link>
      )}

      {/* The Field — players by tier */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">The Field</h2>
        <div className="space-y-3">
          {tierOrder.map((tier) => {
            const players = playersByTier[tier];
            if (!players || players.length === 0) return null;
            return (
              <div key={tier} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-3 py-2">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{tierLabels[tier]}</h3>
                    <p className="text-[10px] text-zinc-400">{players.length} players</p>
                  </div>
                  {hasScores && (
                    <div className="flex items-center gap-1.5 tabular text-[9px] font-bold uppercase text-zinc-400">
                      <span className="w-6 text-center">R1</span>
                      <span className="w-6 text-center">R2</span>
                      <span className="w-6 text-center">R3</span>
                      <span className="w-6 text-center">R4</span>
                      <span className="w-10 text-center border-l border-zinc-200 dark:border-zinc-700 pl-1.5">Tot</span>
                      <span className="w-8 text-center">Par</span>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                  {players.map((tp) => {
                    const sc = scoreMap.get(tp.playerId);
                    const total = sc ? (sc.roundsPlayed < 4 && sc.madeCut ? sc.total : sc.total) : null;
                    const toPar = sc ? sc.toPar : null;
                    const missedCut = sc && !sc.madeCut;
                    return (
                      <Link
                        key={tp.id}
                        href={`/players/${tp.playerId}`}
                        className="flex items-center gap-2 px-3 py-1.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                      >
                        <span className="w-6 shrink-0 text-right text-xs font-bold tabular text-zinc-400">{tp.player.dataGolfRank ?? "—"}</span>
                        <span className="flex-1 truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">{tp.player.name}</span>
                        {hasScores && sc && (
                          <span className="flex items-center gap-1.5 tabular text-[11px]">
                            {sc.rounds.map((r, i) => (
                              <span key={i} className={`w-6 text-center rounded ${r === null ? "text-zinc-300" : r < par ? "text-green-600 font-semibold" : r > par ? "text-red-500" : "text-zinc-600 dark:text-zinc-400"}`}>{r ?? "—"}</span>
                            ))}
                            <span className="w-10 text-right font-bold border-l border-zinc-100 dark:border-zinc-800 pl-1.5">
                              {missedCut ? <span className="text-red-500">CUT</span> : total}
                            </span>
                            {!missedCut && toPar !== null && (
                              <span className={`w-8 text-right font-bold ${toPar < 0 ? "text-green-600" : toPar > 0 ? "text-red-500" : "text-zinc-500"}`}>
                                {toPar === 0 ? "E" : `${toPar > 0 ? "+" : ""}${toPar}`}
                              </span>
                            )}
                          </span>
                        )}
                        {tp.player.country && !hasScores && <span className="text-[10px] text-zinc-400">{tp.player.country}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
