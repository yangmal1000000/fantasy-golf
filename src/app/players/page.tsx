import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PlayersTable, { type PlayerRowData, type FormResult } from "./PlayersTable";
import { GolfFlagIcon, StarIcon } from "@/components/icons";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Player Rankings — Fantasy Golf",
  description: "Browse all fantasy golf players by world ranking, tier, scoring average, and recent form. Filter by tour, country, and more.",
};

/* ───────────────────────── helpers ───────────────────────── */

/** Encode a tournament finish as a colored form dot */
function formFromPosition(position: number | null, madeCut: boolean | null): FormResult | null {
  if (position == null) return null;
  if (madeCut === false) return { label: "MC", color: "#dc2626" }; // red
  if (position === 1) return { label: "W", color: "#f59e0b" }; // gold
  if (position <= 5) return { label: `${position}`, color: "#16a34a" }; // green
  if (position <= 10) return { label: `${position}`, color: "#3b82f6" }; // blue
  if (position <= 20) return { label: `${position}`, color: "#14b8a6" }; // teal
  return { label: `${position}`, color: "#94a3b8" }; // gray
}

interface SearchParams {
  tour?: string;
  page?: string;
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const tour = sp.tour === "women" ? "women" : "men";
  const isWomen = tour === "women";
  const page = parseInt(sp.page ?? "1", 10);
  const pageSize = 100;
  const skip = (page - 1) * pageSize;

  /* ── Fetch all data in parallel ── */
  const [players, tournaments, allScores, allTPs, teamGroups] = await Promise.all([
    prisma.player.findMany({
      select: {
        id: true,
        name: true,
        country: true,
        dataGolfRank: true,
        tour: true,
        photoUrl: true,
        tournaments: {
          include: {
            tournament: { select: { id: true, name: true, category: true, tour: true, par: true, startDate: true } },
            selections: { select: { id: true } },
          },
        },
        scores: { select: { tournamentId: true, round: true, strokes: true } },
      },
    }),
    prisma.tournament.findMany({
      select: { id: true, name: true, category: true, tour: true, par: true, startDate: true },
    }),
    prisma.score.findMany({
      where: { strokes: { not: null } },
      select: { playerId: true, tournamentId: true, round: true, strokes: true },
    }),
    prisma.tournamentPlayer.findMany({
      select: { playerId: true, tournamentId: true, tier: true, madeCut: true, withdrew: true },
    }),
    prisma.team.groupBy({ by: ["tournamentId"], _count: { _all: true } }),
  ]);

  /* ── Build lookup maps ── */
  const tournamentMap = new Map(tournaments.map((t) => [t.id, t]));
  const teamCountMap = new Map<string, number>();
  for (const g of teamGroups) teamCountMap.set(g.tournamentId, g._count._all);

  /** All TournamentPlayer entries keyed by `tournamentId:playerId` */
  const tpKey = (tid: string, pid: string) => `${tid}:${pid}`;
  const tpMap = new Map<string, { tier: string; madeCut: boolean | null; withdrew: boolean }>();
  for (const tp of allTPs) {
    tpMap.set(tpKey(tp.tournamentId, tp.playerId), {
      tier: tp.tier,
      madeCut: tp.madeCut,
      withdrew: tp.withdrew,
    });
  }

  /* ── Compute per-tournament standings from all scores ── */
  // Group: tournamentId → playerId → total strokes & rounds played
  const tScores = new Map<string, Map<string, { total: number; rounds: number }>>();
  for (const s of allScores) {
    if (s.strokes == null) continue;
    if (!tScores.has(s.tournamentId)) tScores.set(s.tournamentId, new Map());
    const inner = tScores.get(s.tournamentId)!;
    if (!inner.has(s.playerId)) inner.set(s.playerId, { total: 0, rounds: 0 });
    const entry = inner.get(s.playerId)!;
    entry.total += s.strokes;
    entry.rounds += 1;
  }

  // For each tournament, compute positions
  const positionsByTournament = new Map<string, Map<string, number>>();
  for (const [tid, scoreMap] of tScores) {
    const entries = Array.from(scoreMap.entries()).map(([pid, data]) => {
      const tp = tpMap.get(tpKey(tid, pid));
      return {
        pid,
        total: data.total,
        rounds: data.rounds,
        madeCut: tp?.madeCut ?? null,
        withdrew: tp?.withdrew ?? false,
      };
    });

    // Sort: withdrew → bottom; missed cut → below made cut; then by total ascending
    entries.sort((a, b) => {
      if (a.withdrew !== b.withdrew) return a.withdrew ? 1 : -1;
      // Players with more rounds rank higher (they made the cut)
      if (a.rounds !== b.rounds) return b.rounds - a.rounds;
      return a.total - b.total;
    });

    const posMap = new Map<string, number>();
    entries.forEach((e, i) => posMap.set(e.pid, i + 1));
    positionsByTournament.set(tid, posMap);
  }

  /* ── Build player row data ── */
  const rows: PlayerRowData[] = [];
  const allCountries = new Set<string>();

  for (const player of players) {
    if (player.country) allCountries.add(player.country);

    // Determine tour: explicit Player.tour field takes priority,
    // then fallback to tournament-link-based detection
    let isPlayerWomen: boolean;
    if (player.tour) {
      isPlayerWomen = player.tour === "lpga";
    } else {
      const playerTournamentsAll = player.tournaments.filter(
        (tp) => tournamentMap.has(tp.tournamentId),
      );
      isPlayerWomen = playerTournamentsAll.length > 0 &&
        playerTournamentsAll.filter((tp) => tournamentMap.get(tp.tournamentId)?.tour === "lpga").length > playerTournamentsAll.length / 2;
    }
    if (isWomen && !isPlayerWomen) continue;
    if (!isWomen && isPlayerWomen) continue;

    const playerTournaments = player.tournaments.filter(
      (tp) => tournamentMap.has(tp.tournamentId),
    );

    // Tournament count
    const tournamentCount = player.tournaments.length;

    // Selection rate
    const totalSelections = player.tournaments.reduce((sum, tp) => sum + tp.selections.length, 0);
    const totalTeams = player.tournaments.reduce(
      (sum, tp) => sum + (teamCountMap.get(tp.tournamentId) ?? 0),
      0,
    );
    const selectionRate = totalTeams > 0 ? (totalSelections / totalTeams) * 100 : 0;

    // Average score
    const validScores = player.scores
      .map((s) => s.strokes)
      .filter((s): s is number => s != null);
    const avgScore =
      validScores.length > 0
        ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
        : null;

    // Finishes with positions
    const finishes: {
      tournamentId: string;
      position: number;
      startDate: Date;
      madeCut: boolean | null;
    }[] = [];

    let bestFinish: number | null = null;

    for (const tp of player.tournaments) {
      const t = tournamentMap.get(tp.tournamentId);
      const posMap = positionsByTournament.get(tp.tournamentId);
      if (!t || !posMap) continue;

      const pos = posMap.get(player.id);
      if (pos != null) {
        finishes.push({
          tournamentId: tp.tournamentId,
          position: pos,
          startDate: t.startDate,
          madeCut: tp.madeCut,
        });
        if (bestFinish === null || pos < bestFinish) bestFinish = pos;
      }
    }

    // Form: last 5 events by start date desc
    finishes.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
    const form: FormResult[] = finishes
      .slice(0, 5)
      .map((f) => formFromPosition(f.position, f.madeCut))
      .filter((f): f is FormResult => f != null);

    // Most common tier (prefer most recent tournament's tier)
    let bestTier: string | null = null;
    if (player.tournaments.length > 0) {
      // Sort by tournament start date descending
      const sorted = [...player.tournaments]
        .map((tp) => ({ tier: tp.tier, date: tournamentMap.get(tp.tournamentId)?.startDate ?? new Date(0) }))
        .sort((a, b) => b.date.getTime() - a.date.getTime());
      bestTier = sorted[0]?.tier ?? null;
    }

    rows.push({
      id: player.id,
      name: player.name,
      country: player.country,
      photoUrl: player.photoUrl,
      dataGolfRank: player.dataGolfRank,
      tier: bestTier,
      tournamentCount,
      selectionRate: Math.round(selectionRate * 10) / 10,
      avgScore,
      bestFinish,
      form,
    });
  }

  // Default sort: by world rank
  rows.sort((a, b) => {
    if (a.dataGolfRank != null && b.dataGolfRank != null)
      return a.dataGolfRank - b.dataGolfRank;
    if (a.dataGolfRank != null) return -1;
    if (b.dataGolfRank != null) return 1;
    return a.name.localeCompare(b.name);
  });

  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = rows.slice(skip, skip + pageSize);
  const countries = Array.from(allCountries).sort();

  /* ── Stats summary ── */
  const totalPlayers = rows.length;
  const totalWithScores = rows.filter((r) => r.avgScore != null).length;

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8">
      {/* ── Header ── */}
      <div className="mb-5 sm:mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">
          Player Rankings
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {totalPlayers} {isWomen ? "women's" : "men's"} tour players
          {totalWithScores > 0 && ` · ${totalWithScores} with scoring data`}
        </p>
        {totalWithScores === 0 && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Rankings shown by Data Golf world rank. Scoring columns appear once tournaments begin.
          </p>
        )}
      </div>

      {/* ── Tour Tabs ── */}
      <div className="mb-5 inline-flex rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1 shadow-sm">
        <Link
          href="/players?tour=men"
          className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
            !isWomen
              ? "bg-[#1a6b3c] text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <GolfFlagIcon className="h-4 w-4" /> Men&apos;s
        </Link>
        <Link
          href="/players?tour=women"
          className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
            isWomen
              ? "bg-pink-600 text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <StarIcon className="h-4 w-4" /> Women&apos;s
        </Link>
      </div>

      {/* ── Table ── */}
      <PlayersTable players={paginatedRows} countries={countries} totalPages={totalPages} currentPage={page} tour={tour} />
    </div>
  );
}
