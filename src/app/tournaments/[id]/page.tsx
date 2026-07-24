import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  ROCKET_BETA_TOURNAMENT_ID,
  ensureRocketBetaCampaign,
  getRocketBetaStateForUser,
} from "@/lib/rocket-beta";
import {
  ROCKET_BETA_ENTRY_DEADLINE_CONFIRMED,
  formatRocketBetaEntryDeadline,
} from "@/lib/rocket-beta-config";
import {
  formatDateRange,
  STATUS_CONFIG,
  CATEGORY_CONFIG,
  courseImage,
  formatGBP,
  majorTheme,
  majorKey,
} from "@/lib/ui";
import { roundScoreClass, toParClass, toParDisplay } from "@/lib/score-colors";
import { calculateLeaderboard, type TeamScoreResult } from "@/lib/scoring";
import {
  assignRocketFieldTiers,
  ROCKET_FIELD_TIER_ORDER,
  ROCKET_MIN_RANKED_PLAYERS,
  rocketTierCopy,
} from "@/lib/rocket-tiers";
import MajorScoreboard from "@/components/MajorScoreboard";
import {
  MapPinIcon,
  UsersIcon,
  ChartBarIcon,
  GolfFlagIcon,
  TrophyIcon,
  TargetIcon,
  BoltIcon,
  FlagIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await prisma.tournament.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!t) return { title: "Tournament — Fantasy Golf" };
  const description =
    id === ROCKET_BETA_TOURNAMENT_ID
      ? "Join the free Rocket Classic test flight: complete Target, unlock a Test Pass and build a five-player team."
      : `Tournament details, field, and entry for ${t.name}.`;
  return {
    title: `${t.name} — Fantasy Golf`,
    description,
    ...(id === ROCKET_BETA_TOURNAMENT_ID
      ? {
          openGraph: {
            title: "Rocket Classic Free Test Flight",
            description,
            type: "website",
            images: [
              {
                url: "/courses/detroit-gc.jpg",
                width: 1024,
                height: 1024,
                alt: "Artistic aerial impression of Detroit Golf Club",
              },
            ],
          },
          twitter: {
            card: "summary_large_image",
            title: "Rocket Classic Free Test Flight",
            description,
            images: ["/courses/detroit-gc.jpg"],
          },
        }
      : {}),
  };
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isRocketBeta = id === ROCKET_BETA_TOURNAMENT_ID;

  const [tournament, betaUser] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                country: true,
                dataGolfRank: true,
              },
            },
          },
        },
        _count: { select: { teams: true, players: true } },
      },
    }),
    isRocketBeta ? getCurrentUser() : Promise.resolve(null),
  ]);

  if (!tournament) notFound();
  const [betaState, betaCampaign] = await Promise.all([
    isRocketBeta && betaUser
      ? getRocketBetaStateForUser(betaUser)
      : Promise.resolve(null),
    isRocketBeta ? ensureRocketBetaCampaign() : Promise.resolve(null),
  ]);
  const betaResult = parseRocketBetaResult(betaCampaign?.results);

  // Fetch scores for this tournament
  const scores = await prisma.score.findMany({
    where: { tournamentId: id, strokes: { not: null } },
    select: { playerId: true, round: true, strokes: true },
  });

  // Build score lookup: playerId -> { round -> strokes, total, toPar, madeCut }
  const par = tournament.par;
  const scoreMap = new Map<
    string,
    {
      rounds: (number | null)[];
      total: number;
      toPar: number;
      madeCut: boolean;
      roundsPlayed: number;
    }
  >();
  for (const s of scores) {
    if (!scoreMap.has(s.playerId))
      scoreMap.set(s.playerId, {
        rounds: [null, null, null, null],
        total: 0,
        toPar: 0,
        madeCut: true,
        roundsPlayed: 0,
      });
    const entry = scoreMap.get(s.playerId)!;
    entry.rounds[s.round - 1] = s.strokes;
  }
  for (const [, entry] of scoreMap) {
    entry.roundsPlayed = entry.rounds.filter((r) => r !== null).length;
    entry.total = entry.rounds
      .filter((r): r is number => r !== null)
      .reduce((a, b) => a + b, 0);
    entry.toPar = entry.total - par * entry.roundsPlayed;
    entry.madeCut = entry.roundsPlayed >= 3; // Made cut if they played R3
  }
  const hasScores = scores.length > 0;

  // Compute winner and runner-up for completed tournaments
  // Sort: most rounds played first (prefer 4-round finishers), then lowest total
  const sortedScorers = [...scoreMap.entries()]
    .filter(([, s]) => s.roundsPlayed > 0)
    .sort((a, b) => {
      // Players who made the cut (played R3+) always rank above those who didn't
      const aMadeCut = a[1].roundsPlayed >= 3;
      const bMadeCut = b[1].roundsPlayed >= 3;
      if (aMadeCut !== bMadeCut) return aMadeCut ? -1 : 1;
      // Among same cut status, more rounds = higher ranked
      if (a[1].roundsPlayed !== b[1].roundsPlayed)
        return b[1].roundsPlayed - a[1].roundsPlayed;
      // Then by lowest total
      return a[1].total - b[1].total;
    });
  const winnerEntry = sortedScorers[0];
  const runnerUpEntry = sortedScorers[1];
  // Build playerId -> name map for winner display
  const playerNameMap = new Map<string, string>();
  const playerCountryMap = new Map<string, string | null>();
  for (const tp of tournament.players) {
    playerNameMap.set(tp.playerId, tp.player.name);
    playerCountryMap.set(tp.playerId, tp.player.country);
  }
  const isCompleted = tournament.status === "completed";

  // Cut line info: count players who made the cut (played R3) vs total
  const totalScorers = sortedScorers.length;
  const showCutInfo =
    hasScores &&
    (tournament.status === "completed" ||
      tournament.status === "in_progress") &&
    totalScorers > 0;
  // R2 leader score (top score after 2 rounds) for cut context
  const r2Scores = sortedScorers
    .map(([pid, s]) => ({
      pid,
      r2Total: (s.rounds[0] ?? Infinity) + (s.rounds[1] ?? Infinity),
    }))
    .filter((x) => x.r2Total < Infinity)
    .sort((a, b) => a.r2Total - b.r2Total);
  const cutScore =
    r2Scores.length > 0
      ? r2Scores[Math.min(64, r2Scores.length - 1)]?.r2Total
      : null;

  const status = STATUS_CONFIG[tournament.status] ?? STATUS_CONFIG.upcoming;
  const theme = isRocketBeta ? null : majorTheme(tournament.id);
  const winnerCardClass = theme
    ? theme.winnerCardClass
    : "border-[#c8a951]/40 bg-gradient-to-br from-[#c8a951]/10 to-transparent";
  const cat = isRocketBeta ? null : CATEGORY_CONFIG[tournament.category];
  const canEnter =
    tournament.status === "entries_open" || tournament.status === "upcoming";
  const isLive = tournament.status === "in_progress";
  const potValue = tournament.entryFee * tournament._count.teams;

  // Group players by tier
  const tierOrder = [...ROCKET_FIELD_TIER_ORDER];
  const rocketFieldIsStaged =
    isRocketBeta &&
    Boolean(
      betaCampaign?.provisionalFieldReadyAt || betaCampaign?.fieldFrozenAt,
    );
  const rocketRankedPreviewCount = isRocketBeta
    ? tournament.players.filter(
        (tp) =>
          Number.isInteger(tp.player.dataGolfRank) &&
          Number(tp.player.dataGolfRank) > 0,
      ).length
    : 0;
  const showRocketBalancedPreview =
    isRocketBeta &&
    !rocketFieldIsStaged &&
    tournament.players.length >= 50 &&
    rocketRankedPreviewCount >= ROCKET_MIN_RANKED_PLAYERS;
  const useRocketFieldRelativeTiers =
    isRocketBeta && (rocketFieldIsStaged || showRocketBalancedPreview);
  const rocketPreviewTierByTournamentPlayerId = showRocketBalancedPreview
    ? new Map(
        assignRocketFieldTiers(
          tournament.players.map((tp) => ({
            id: tp.id,
            name: tp.player.name,
            rank: tp.player.dataGolfRank,
          })),
        ).map((player) => [player.id, player.tier]),
      )
    : new Map<string, string>();
  const defaultTierLabels: Record<string, string> = {
    T1_10: "Tier 1 (Ranks 1–10)",
    T11_20: "Tier 2 (Ranks 11–20)",
    T21_30: "Tier 3 (Ranks 21–30)",
    T31_50: "Tier 4 (Ranks 31–50)",
    T51_PLUS: "Tier 5 (Ranks 51+)",
  };
  const tierLabels = Object.fromEntries(
    tierOrder.map((tier) => [
      tier,
      useRocketFieldRelativeTiers
        ? (rocketTierCopy(tier)?.label ?? defaultTierLabels[tier])
        : defaultTierLabels[tier],
    ]),
  );
  const playersByTier: Record<string, typeof tournament.players> = {};
  for (const tp of tournament.players) {
    const tier = showRocketBalancedPreview
      ? (rocketPreviewTierByTournamentPlayerId.get(tp.id) ??
        tp.tier ??
        "T51_PLUS")
      : (tp.tier ?? "T51_PLUS");
    if (!playersByTier[tier]) playersByTier[tier] = [];
    playersByTier[tier].push(tp);
  }
  for (const t of tierOrder) {
    if (playersByTier[t]) {
      playersByTier[t].sort(
        (a, b) =>
          (a.player.dataGolfRank ?? 999) - (b.player.dataGolfRank ?? 999),
      );
    }
  }

  // Fetch fantasy team leaderboard for mini-leaderboard
  let fantasyLeaderboard: TeamScoreResult[] = [];
  try {
    fantasyLeaderboard = await calculateLeaderboard(id);
  } catch {}
  const hasFantasyTeams = fantasyLeaderboard.length > 0;
  const topTeams = fantasyLeaderboard.slice(0, 5);

  // Detect major for skeuomorphic scoreboard
  const mk = isRocketBeta ? null : majorKey(id);

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Breadcrumb */}
      <Link
        href="/tournaments"
        className="text-xs text-zinc-500 hover:text-[#0a3d2a] dark:hover:text-green-400"
      >
        ← Tournaments
      </Link>

      {/* Header banner */}
      <div
        className={`relative mt-2 overflow-hidden rounded-xl ${theme ? `ring-1 ${theme.borderAccent}` : ""}`}
      >
        {isRocketBeta ? (
          <div className="h-52 sm:h-60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/courses/detroit-gc.jpg"
              alt="Artistic aerial impression of Detroit Golf Club"
              className="h-full w-full object-cover"
            />
            <div className="absolute right-5 top-5 rounded-full border border-white/20 bg-[#071f16]/45 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-white/80 backdrop-blur-sm">
              Detroit · 2026
            </div>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={courseImage(tournament.id, tournament.course)}
            alt={tournament.course || tournament.name}
            className="h-40 w-full object-cover sm:h-48"
          />
        )}
        <div
          className={`absolute inset-0 bg-gradient-to-t ${theme ? theme.headerOverlay : "from-[#071f16]/95 via-[#0a3d2a]/35 to-transparent"}`}
        />
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white sm:p-5">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${isRocketBeta ? "border border-[#e4cc85]/40 bg-[#e4cc85]/15 text-[#f0d986]" : status.badgeClass}`}
            >
              {isRocketBeta ? "OPEN TEST FLIGHT" : status.label}
            </span>
            {cat && (
              <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
                {cat.label}
              </span>
            )}
            {theme && (
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${theme.badgeClass}`}
              >
                {theme.name}
              </span>
            )}
            {isLive && tournament.currentRound > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-[#c44545] px-2 py-0.5 text-[10px] font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />{" "}
                ROUND {tournament.currentRound}
              </span>
            )}
          </div>
          <h1
            className={`mt-1.5 text-xl font-bold tracking-tight sm:text-2xl ${theme ? theme.headerText : "text-white"}`}
          >
            {tournament.name}
          </h1>
          <p
            className={`mt-0.5 flex items-center gap-1.5 text-xs ${theme ? theme.headerSubtext + "/80" : "text-white/90"}`}
          >
            <MapPinIcon className="h-3 w-3" />
            {tournament.course ?? "TBD"} ·{" "}
            {formatDateRange(tournament.startDate, tournament.endDate)}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        <div
          className={`rounded-lg border bg-white dark:bg-zinc-900 p-2.5 text-center ${theme ? theme.borderAccent : "border-zinc-200 dark:border-zinc-800"}`}
        >
          <p
            className={`text-lg font-bold tabular ${theme ? theme.statsAccent : "text-[#0a3d2a] dark:text-green-400"}`}
          >
            {tournament._count.teams}
          </p>
          <p className="text-[10px] text-zinc-500">Teams</p>
        </div>
        <div
          className={`rounded-lg border bg-white dark:bg-zinc-900 p-2.5 text-center ${theme ? theme.borderAccent : "border-zinc-200 dark:border-zinc-800"}`}
        >
          <p
            className={`text-lg font-bold tabular ${theme ? theme.statsAccent : "text-[#0a3d2a] dark:text-green-400"}`}
          >
            {tournament._count.players}
          </p>
          <p className="text-[10px] text-zinc-500">Players</p>
        </div>
        <div
          className={`rounded-lg border bg-white dark:bg-zinc-900 p-2.5 text-center ${theme ? theme.borderAccent : "border-zinc-200 dark:border-zinc-800"}`}
        >
          <p
            className="text-lg font-bold tabular"
            style={theme ? { color: theme.accentHex } : { color: "#c8a951" }}
          >
            {isRocketBeta
              ? betaState?.passState === "REDEEMED"
                ? "Used"
                : betaState?.passState === "UNLOCKED"
                  ? "Ready"
                  : "Locked"
              : formatGBP(tournament.entryFee)}
          </p>
          <p className="text-[10px] text-zinc-500">
            {isRocketBeta ? "Test Pass" : "Entry"}
          </p>
        </div>
        <div
          className={`rounded-lg border bg-white dark:bg-zinc-900 p-2.5 text-center ${theme ? theme.borderAccent : "border-zinc-200 dark:border-zinc-800"}`}
        >
          <p
            className={`text-lg font-bold tabular ${theme ? theme.statsAccent : "text-[#0a3d2a] dark:text-green-400"}`}
          >
            {tournament.par}
          </p>
          <p className="text-[10px] text-zinc-500">Par</p>
        </div>
      </div>

      {isRocketBeta && (
        <section className="mt-3 overflow-hidden rounded-xl border border-[#c8a951]/35 bg-white shadow-sm dark:bg-zinc-900">
          <div className="grid gap-px bg-zinc-100 dark:bg-zinc-800 sm:grid-cols-[1.2fr_1fr]">
            <div className="bg-white p-4 dark:bg-zinc-900 sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
                Your beta route
              </p>
              <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-3 text-sm">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${betaState?.passState !== "LOCKED" ? "bg-[#0a3d2a] text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}
                >
                  1
                </span>
                <div>
                  <p className="font-black text-zinc-900 dark:text-white">
                    Complete Target
                  </p>
                  <p className="text-xs leading-5 text-zinc-500">
                    {betaState?.passState !== "LOCKED"
                      ? "Complete · pass unlocked"
                      : "Three decisions · one locked submission"}
                  </p>
                </div>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${betaState?.passState === "REDEEMED" ? "bg-[#0a3d2a] text-white" : "bg-[#c8a951]/25 text-[#7a5e16]"}`}
                >
                  2
                </span>
                <div>
                  <p className="font-black text-zinc-900 dark:text-white">
                    Confirm five-player team
                  </p>
                  <p className="text-xs leading-5 text-zinc-500">
                    {betaState?.passState === "REDEEMED"
                      ? "Confirmed · follow your live standing here"
                      : betaState?.provisionalFieldReady
                        ? betaState.draft
                          ? "Provisional draft saved · final confirmation pending"
                          : "Weekend drafting open · final confirmation Monday"
                        : "One golfer from each final tier"}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-[#f7f4eb] p-4 dark:bg-[#17251d] sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
                Event brief
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-zinc-500">Dates</dt>
                  <dd className="mt-0.5 font-bold text-zinc-800 dark:text-zinc-100">
                    30 Jul–2 Aug
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Venue</dt>
                  <dd className="mt-0.5 font-bold text-zinc-800 dark:text-zinc-100">
                    Detroit Golf Club
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Course</dt>
                  <dd className="mt-0.5 font-bold text-zinc-800 dark:text-zinc-100">
                    7,328 yds · Par 70
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Beta lock</dt>
                  <dd className="mt-0.5 font-bold text-zinc-800 dark:text-zinc-100">
                    {formatRocketBetaEntryDeadline({
                      closesAt: betaCampaign?.entryClosesAt ?? "",
                      confirmed: ROCKET_BETA_ENTRY_DEADLINE_CONFIRMED,
                    })}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] leading-5 text-zinc-500">
                {!ROCKET_BETA_ENTRY_DEADLINE_CONFIRMED
                  ? "Exact lock time will be shown once the official tee sheet is verified. "
                  : null}
                Open to verified signed-up users. No payment, cash value or
                prize.
              </p>
            </div>
          </div>
        </section>
      )}

      {isRocketBeta && betaCampaign?.finalizedAt && betaResult && (
        <section className="mt-3 rounded-xl border-2 border-[#c8a951]/55 bg-gradient-to-br from-[#c8a951]/15 via-white to-white p-4 shadow-sm dark:via-zinc-900 dark:to-zinc-900 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#c8a951] text-xl shadow-sm">
              🏆
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#e4cc85]">
                Final beta result confirmed
              </p>
              <p className="mt-1 text-lg font-black text-zinc-900 dark:text-white">
                {betaResult.winners.map((team) => team.teamName).join(" & ")}
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                {betaResult.winners.length > 1 ? "Joint winners" : "Winner"} ·{" "}
                {toParDisplay(betaResult.winners[0].vsPar)} across five golfers
              </p>
              {betaCampaign.resultsHash && (
                <p className="mt-2 font-mono text-[9px] text-zinc-400">
                  Sealed result {betaCampaign.resultsHash.slice(0, 12)}
                </p>
              )}
            </div>
          </div>
          <p className="mt-3 border-t border-[#c8a951]/20 pt-3 text-[11px] leading-5 text-zinc-500">
            Test-flight result only. No payment, cash value or prize.
          </p>
        </section>
      )}

      {/* Prize pool + countdown */}
      {!isRocketBeta && potValue > 0 && (
        <div
          className={`mt-2 flex items-center justify-between rounded-lg border p-3 ${theme ? theme.potCardClass : "border-[#c8a951]/30 bg-gradient-to-r from-[#c8a951]/10 to-transparent"}`}
        >
          <div className="flex items-center gap-2">
            <TrophyIcon
              className="h-5 w-5"
              style={{ color: theme ? theme.accentHex : "#c8a951" }}
            />
            <div>
              <p className="text-xs text-zinc-500">Prize Pool</p>
              <p
                className="text-lg font-bold tabular"
                style={{ color: theme ? theme.accentHex : "#c8a951" }}
              >
                {formatGBP(potValue)}
              </p>
            </div>
          </div>
          {canEnter && (
            <div className="text-right">
              <p className="text-xs text-zinc-500">Starts</p>
              <p
                className={`text-sm font-bold tabular ${theme ? theme.statsAccent : "text-[#0a3d2a] dark:text-green-400"}`}
              >
                {tournament.startDate.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div
        className={`mt-4 grid grid-cols-2 gap-2 ${tournament._count.teams > 0 && !isRocketBeta ? "sm:grid-cols-4" : "sm:grid-cols-2"} `}
      >
        {isRocketBeta ? (
          betaState?.approved ? (
            betaState.passState === "REDEEMED" && betaState.teamId ? (
              <Link
                href={`/tournaments/${tournament.id}/teams/${betaState.teamId}`}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#0a3d2a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1a5c3e]"
              >
                <GolfFlagIcon className="h-4 w-4" /> View My Team
              </Link>
            ) : betaState.passState === "LOCKED" ? (
              <Link
                href="/target"
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#0a3d2a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1a5c3e]"
              >
                <TargetIcon className="h-4 w-4" /> Complete Target
              </Link>
            ) : betaState.fieldReady && tournament._count.players > 0 ? (
              <Link
                href={`/tournaments/${tournament.id}/enter`}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#0a3d2a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1a5c3e]"
              >
                <GolfFlagIcon className="h-4 w-4" /> Build My Team
              </Link>
            ) : betaState.provisionalFieldReady &&
              tournament._count.players > 0 ? (
              <Link
                href={`/tournaments/${tournament.id}/enter`}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-[#0a3d2a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1a5c3e]"
              >
                <GolfFlagIcon className="h-4 w-4" />{" "}
                {betaState.draft ? "Edit My Draft" : "Start My Draft"}
              </Link>
            ) : (
              <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#c8a951]/20 px-4 py-2.5 text-sm font-bold text-[#7a5e16] dark:text-[#e4cc85]">
                Test Pass Ready · Field Review
              </div>
            )
          ) : (
            <Link
              href="/target"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[#0a3d2a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1a5c3e]"
            >
              <TargetIcon className="h-4 w-4" /> Sign in to Join
            </Link>
          )
        ) : canEnter && tournament._count.players > 0 ? (
          <Link
            href={`/tournaments/${tournament.id}/enter`}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#0a3d2a] dark:bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1a5c3e]"
          >
            <GolfFlagIcon className="h-4 w-4" /> Enter Team
          </Link>
        ) : canEnter && tournament._count.players === 0 ? (
          <div className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-4 py-2.5 text-sm font-bold text-zinc-400">
            Field TBA
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-4 py-2.5 text-sm font-bold text-zinc-400">
            Entries Closed
          </div>
        )}
        <Link
          href={`/tournaments/${tournament.id}/leaderboard`}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-zinc-300"
        >
          <ChartBarIcon className="h-4 w-4" /> Leaderboard
        </Link>
        {tournament._count.teams > 0 && !isRocketBeta && (
          <Link
            href={`/tournaments/${tournament.id}/draft-board`}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-zinc-300"
          >
            <UsersIcon className="h-4 w-4" /> Draft Board
          </Link>
        )}
        {tournament._count.teams > 0 && !isRocketBeta && (
          <Link
            href={`/tournaments/${tournament.id}/side-games`}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-zinc-300"
          >
            <TargetIcon className="h-4 w-4" /> Side Games
          </Link>
        )}
      </div>

      {isRocketBeta && !betaCampaign?.fieldFrozenAt && (
        <div className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-200">
          <strong>
            {betaCampaign?.provisionalFieldReadyAt
              ? "Official initial field · drafts open."
              : showRocketBalancedPreview
                ? "Balanced provisional preview."
                : "Provisional field review."}
          </strong>{" "}
          {betaCampaign?.provisionalFieldReadyAt
            ? "Test Pass holders can save five weekend picks now. Four Monday qualifiers plus possible withdrawals and alternates remain pending; official confirmation follows the final five-tier freeze."
            : showRocketBalancedPreview
              ? "The current provisional list is arranged as 10 / 10 / 10 / 20 / remaining field so you can preview the real game structure. Player names and tiers may change after tonight’s official PGA TOUR update. Drafting stays locked until the post-deadline field passes verification."
              : "The staged commitment list is for inspection only. Drafting opens after PGA TOUR/PGATOUR.COM publishes the official post-deadline field."}
        </div>
      )}

      {/* Live tracker link for in-progress */}
      {isLive && (
        <Link
          href={`/tournaments/${tournament.id}/live`}
          className="mt-2 flex items-center justify-between rounded-lg border border-[#c44545]/30 bg-gradient-to-r from-[#c44545]/10 to-transparent p-3 transition hover:border-[#c44545]/50"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c44545] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#c44545]" />
            </span>
            <span className="text-sm font-bold text-[#c44545]">
              Live Match Tracker
            </span>
          </div>
          <span className="text-sm font-bold text-[#c44545]">
            Follow Live →
          </span>
        </Link>
      )}

      {/* ===== Mini Leaderboard (Top 5 fantasy teams) — HIGH PRIORITY ===== */}
      {hasFantasyTeams && (
        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2
              className={`flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide ${theme ? theme.cutLineClass : "text-zinc-500"}`}
            >
              <TrophyIcon className="h-3.5 w-3.5" />
              Fantasy Leaderboard
            </h2>
            <Link
              href={`/tournaments/${id}/leaderboard`}
              className={`text-xs font-medium hover:underline ${theme ? theme.cutLineClass : "text-[#0a3d2a] dark:text-green-400"}`}
            >
              Full standings →
            </Link>
          </div>
          <div
            className={`overflow-hidden rounded-xl border bg-white dark:bg-zinc-900 shadow-sm ${theme ? theme.borderAccent : "border-zinc-200 dark:border-zinc-800"}`}
          >
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {topTeams.map((team) => (
                <div
                  key={team.teamId}
                  className="border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                >
                  <Link
                    href={`/tournaments/${id}/teams/${team.teamId}`}
                    className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        team.position === 1
                          ? theme
                            ? theme.positionFirst
                            : "bg-[#c8a951] text-[#1a1a1a]"
                          : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                      }`}
                    >
                      {team.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">
                        {team.teamName}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {team.ownerName}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-base font-bold tabular ${theme ? theme.statsAccent : "text-[#0a3d2a] dark:text-green-400"}`}
                      >
                        {team.totalStrokes}
                      </p>
                      <p
                        className={`text-[11px] font-semibold ${toParClass(team.vsPar)}`}
                      >
                        {toParDisplay(team.vsPar)}
                      </p>
                    </div>
                  </Link>
                  {/* Player roster with tiers and scores */}
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 pb-2.5">
                    {team.players.map((p) => {
                      const pScore = p.roundScores
                        .filter((s) => s != null)
                        .reduce((a, b) => a + (b as number), 0);
                      return (
                        <Link
                          key={p.playerId}
                          href={`/players/${p.playerId}`}
                          className="shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 transition hover:border-zinc-300 dark:hover:border-zinc-600"
                          title={`${p.playerName} (${p.tier}): ${p.roundScores.map((s) => s ?? "-").join(", ")}`}
                        >
                          <div className="flex items-center gap-1">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                p.tier === "T1_10"
                                  ? "bg-amber-400"
                                  : p.tier === "T11_20"
                                    ? "bg-blue-400"
                                    : p.tier === "T21_30"
                                      ? "bg-emerald-400"
                                      : p.tier === "T31_50"
                                        ? "bg-purple-400"
                                        : "bg-zinc-400"
                              }`}
                            />
                            <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                              {p.playerName.split(" ").slice(-1)[0]}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 tabular text-[9px]">
                            {p.roundScores.map((r, i) => (
                              <span
                                key={i}
                                className={
                                  r === null
                                    ? "text-zinc-300 dark:text-zinc-600"
                                    : roundScoreClass(r, tournament.par)
                                }
                              >
                                {r ?? "-"}
                              </span>
                            ))}
                            <span className="ml-0.5 font-bold text-zinc-600 dark:text-zinc-400">
                              {pScore > 0 ? pScore : ""}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <Link
              href={`/tournaments/${id}/leaderboard`}
              className="block border-t border-zinc-100 dark:border-zinc-800 py-2 text-center text-xs font-semibold text-zinc-500 hover:text-[#0a3d2a] dark:hover:text-green-400"
            >
              View all {fantasyLeaderboard.length} teams →
            </Link>
          </div>
        </section>
      )}

      {/* Winner card for completed tournaments */}
      {isCompleted && winnerEntry && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {/* Winner */}
          <div
            className={`flex items-center gap-3 rounded-xl border-2 p-4 shadow-sm ${winnerCardClass}`}
          >
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${theme ? theme.winnerIconBg : "bg-[#c8a951]"} text-2xl shadow-md`}
            >
              {theme ? theme.winnerEmoji : "🏆"}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#c8a951]">
                Winner
              </p>
              <p className="truncate text-base font-bold text-zinc-800 dark:text-zinc-100">
                {playerNameMap.get(winnerEntry[0]) ?? "Unknown"}
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold tabular text-[#0a3d2a] dark:text-green-400">
                  {winnerEntry[1].total}
                </span>
                <span
                  className={`font-semibold ${toParClass(winnerEntry[1].toPar)}`}
                >
                  ({toParDisplay(winnerEntry[1].toPar)})
                </span>
                {playerCountryMap.get(winnerEntry[0]) && (
                  <span className="text-xs text-zinc-400">
                    {playerCountryMap.get(winnerEntry[0])}
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Runner-up */}
          {runnerUpEntry && (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-xl">
                🥈
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  Runner-up
                </p>
                <p className="truncate text-base font-bold text-zinc-800 dark:text-zinc-100">
                  {playerNameMap.get(runnerUpEntry[0]) ?? "Unknown"}
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold tabular text-zinc-700 dark:text-zinc-300">
                    {runnerUpEntry[1].total}
                  </span>
                  <span
                    className={`font-semibold ${toParClass(runnerUpEntry[1].toPar)}`}
                  >
                    ({toParDisplay(runnerUpEntry[1].toPar)})
                  </span>
                  {playerCountryMap.get(runnerUpEntry[0]) && (
                    <span className="text-xs text-zinc-400">
                      {playerCountryMap.get(runnerUpEntry[0])}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Merged Cut Line info ===== */}
      {showCutInfo &&
        (() => {
          const mergedMadeCut = [...scoreMap.values()].filter(
            (s) => s.madeCut,
          ).length;
          const mergedMissedCut = [...scoreMap.values()].filter(
            (s) => s.roundsPlayed > 0 && !s.madeCut,
          ).length;
          if (mergedMadeCut === 0 && mergedMissedCut === 0) return null;
          return (
            <div
              className={`mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border p-3 text-sm shadow-sm ${theme ? `${theme.cutBadgeClass}` : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"}`}
            >
              <div className="flex items-center gap-2">
                <BoltIcon className="h-4 w-4 text-[#0a3d2a] dark:text-green-400" />
                <span className="font-bold uppercase text-xs tracking-wide text-zinc-500">
                  Cut Line
                </span>
              </div>
              {tournament.cutLine != null ? (
                <span
                  className={`font-bold tabular ${theme ? theme.cutLineClass : "text-[#0a3d2a] dark:text-green-400"}`}
                >
                  {tournament.cutLine > tournament.par * 2 ? "+" : ""}
                  {tournament.cutLine - tournament.par * 2 === 0
                    ? "E"
                    : tournament.cutLine - tournament.par * 2}
                </span>
              ) : cutScore != null ? (
                <span className="font-bold tabular text-[#0a3d2a] dark:text-green-400">
                  {cutScore - tournament.par * 2 === 0
                    ? "E"
                    : `${cutScore - tournament.par * 2 > 0 ? "+" : ""}${cutScore - tournament.par * 2}`}
                  <span className="ml-1 text-xs font-normal text-zinc-400">
                    (est. top 65)
                  </span>
                </span>
              ) : (
                <span className="text-zinc-400">Not yet determined</span>
              )}
              <span className="text-zinc-500 dark:text-zinc-400">
                Made the cut:{" "}
                <strong className="text-[#0a3d2a] dark:text-green-400">
                  {mergedMadeCut}
                </strong>{" "}
                {mergedMadeCut === 1 ? "player" : "players"}
              </span>
              {mergedMissedCut > 0 && (
                <span className="text-zinc-500 dark:text-zinc-400">
                  Missed:{" "}
                  <strong className="text-red-500">{mergedMissedCut}</strong>
                </span>
              )}
            </div>
          );
        })()}

      {/* Course Profile (reference — lower priority) */}
      <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="flex items-center gap-2 mb-3">
          <FlagIcon className="h-4 w-4 text-[#0a3d2a] dark:text-green-400" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
            Course Profile
          </h2>
        </div>
        {tournament.course ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase text-zinc-400">Course</p>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                <MapPinIcon className="h-3.5 w-3.5 text-zinc-400" />
                {tournament.course}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-zinc-400">Par</p>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {tournament.par}
              </p>
            </div>
            {tournament.yardage && (
              <div>
                <p className="text-[10px] uppercase text-zinc-400">Yardage</p>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {tournament.yardage.toLocaleString()} yds
                </p>
              </div>
            )}
            {tournament.architect && (
              <div>
                <p className="text-[10px] uppercase text-zinc-400">Architect</p>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {tournament.architect}
                </p>
              </div>
            )}
            {tournament.courseLocation && (
              <div>
                <p className="text-[10px] uppercase text-zinc-400">Location</p>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {tournament.courseLocation}
                </p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase text-zinc-400">Tour</p>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 uppercase">
                {tournament.tour}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">Course details TBA</p>
        )}
      </div>

      {/* ===== Skeuomorphic Major Scoreboard (replaces generic field for majors with scores) ===== */}
      {mk && hasScores ? (
        <div className="mt-6">
          <MajorScoreboard
            players={[...scoreMap.entries()]
              .filter(([, s]) => s.roundsPlayed > 0)
              .sort((a, b) => {
                const aMadeCut = a[1].roundsPlayed >= 3;
                const bMadeCut = b[1].roundsPlayed >= 3;
                if (aMadeCut !== bMadeCut) return aMadeCut ? -1 : 1;
                if (a[1].roundsPlayed !== b[1].roundsPlayed)
                  return b[1].roundsPlayed - a[1].roundsPlayed;
                return a[1].total - b[1].total;
              })
              .map(([pid, s], idx) => ({
                playerId: pid,
                playerName: playerNameMap.get(pid) ?? "Unknown",
                country: playerCountryMap.get(pid) ?? null,
                rounds: s.rounds,
                total: s.total,
                toPar: s.toPar,
                roundsPlayed: s.roundsPlayed,
                position: idx + 1,
                madeCut: s.madeCut,
              }))}
            par={tournament.par}
            major={
              mk as "masters" | "pga-championship" | "us-open" | "the-open"
            }
          />
        </div>
      ) : (
        <div className="mt-6">
          {/* The Field — players by tier */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
              The Field
            </h2>
            {showRocketBalancedPreview && (
              <span className="rounded-full border border-amber-300/70 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
                Provisional preview · 10 / 10 / 10 / 20 / rest
              </span>
            )}
          </div>
          {tournament.players.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-8 text-center">
              <div className="mb-2 text-3xl">⛳</div>
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Field will be announced closer to the event
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Check back closer to tournament week for the full player field.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tierOrder.map((tier) => {
                const players = playersByTier[tier];
                if (!players || players.length === 0) return null;
                return (
                  <div
                    key={tier}
                    className={`rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden ${theme ? theme.borderAccent : "border-zinc-200 dark:border-zinc-800"}`}
                  >
                    <div
                      className={`flex items-center justify-between border-b px-3 py-2 ${theme ? theme.tierHeaderClass : "border-zinc-100 dark:border-zinc-800"}`}
                    >
                      <div>
                        <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          {tierLabels[tier]}
                        </h3>
                        <p className="text-[10px] text-zinc-400">
                          {players.length}{" "}
                          {players.length === 1 ? "player" : "players"}
                        </p>
                      </div>
                      {hasScores && (
                        <div className="flex items-center gap-1.5 tabular text-[9px] font-bold uppercase text-zinc-400">
                          <span className="w-6 text-center">R1</span>
                          <span className="w-6 text-center">R2</span>
                          <span className="w-6 text-center">R3</span>
                          <span className="w-6 text-center">R4</span>
                          <span className="w-10 text-center border-l border-zinc-200 dark:border-zinc-700 pl-1.5">
                            Tot
                          </span>
                          <span className="w-8 text-center">Par</span>
                        </div>
                      )}
                    </div>
                    <div className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                      {players.map((tp) => {
                        const sc = scoreMap.get(tp.playerId);
                        const total = sc
                          ? sc.roundsPlayed < 4 && sc.madeCut
                            ? sc.total
                            : sc.total
                          : null;
                        const toPar = sc ? sc.toPar : null;
                        const missedCut = sc && !sc.madeCut;
                        return (
                          <Link
                            key={tp.id}
                            href={`/players/${tp.playerId}`}
                            className="flex items-center gap-2 px-3 py-1.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                          >
                            <span className="w-6 shrink-0 text-right text-xs font-bold tabular text-zinc-400">
                              {tp.player.dataGolfRank ?? "—"}
                            </span>
                            <span className="flex-1 truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                              {tp.player.name}
                            </span>
                            {hasScores && sc && (
                              <span className="flex items-center gap-1.5 tabular text-[11px]">
                                {sc.rounds.map((r, i) => (
                                  <span
                                    key={i}
                                    className={`w-6 text-center rounded ${roundScoreClass(r, par)}`}
                                  >
                                    {r ?? "—"}
                                  </span>
                                ))}
                                <span className="w-10 text-right font-bold border-l border-zinc-100 dark:border-zinc-800 pl-1.5">
                                  {missedCut ? (
                                    <span className="text-red-500">CUT</span>
                                  ) : (
                                    total
                                  )}
                                </span>
                                {!missedCut && toPar !== null && (
                                  <span
                                    className={`w-8 text-right font-bold ${toParClass(toPar!)}`}
                                  >
                                    {toParDisplay(toPar!)}
                                  </span>
                                )}
                              </span>
                            )}
                            {tp.player.country && !hasScores && (
                              <span className="text-[10px] text-zinc-400">
                                {tp.player.country}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function parseRocketBetaResult(value: unknown) {
  if (!value || typeof value !== "object" || !("teams" in value)) return null;
  const teams = (value as { teams?: unknown }).teams;
  if (!Array.isArray(teams)) return null;
  const winners = teams.filter(
    (team): team is { teamName: string; position: number; vsPar: number } =>
      Boolean(
        team &&
        typeof team === "object" &&
        (team as { position?: unknown }).position === 1 &&
        typeof (team as { teamName?: unknown }).teamName === "string" &&
        typeof (team as { vsPar?: unknown }).vsPar === "number",
      ),
  );
  return winners.length > 0 ? { winners } : null;
}
