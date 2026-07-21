import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Tournaments — Fantasy Golf",
  description: "Browse and enter upcoming fantasy golf tournaments.",
};
import { formatDateRange, STATUS_CONFIG, courseImage, CATEGORY_CONFIG } from "@/lib/ui";
import { toParDisplay } from "@/lib/score-colors";
import CountdownTimer from "@/components/CountdownTimer";
import { Suspense } from "react";
import { TournamentListSkeleton } from "@/components/Skeletons";
import TournamentSearch from "./TournamentSearch";
import { GolfFlagIcon, MapPinIcon, UsersIcon, PoundIcon, ChartBarIcon, StarIcon, TrophyIcon } from "@/components/icons";

// Cache for 60 seconds — dramatically reduces DB load and page latency
export const revalidate = 300; // ISR — 5 minutes

type TournamentRow = {
  id: string; name: string; course: string | null;
  startDate: Date; endDate: Date; status: string; par: number;
  entryFee: number; currentRound: number; category: string; tour: string;
  _count: { teams: number; players: number };
};

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<{ tour?: string; cat?: string; year?: string; past?: string; status?: string; q?: string }> }) {
  const params = await searchParams;
  const tour = params.tour ?? "men"; // default to men's (no param = men's)
  const showWomen = tour === "women";
  const showAll = tour === "all";
  const showMen = tour === "men";
  const activeCategory = params.cat ?? "all";
  const activeYear = params.year ?? "all";
  // Status filter: "upcoming" (default), "live", "all"
  // Backward compat: ?past=1 maps to status=all
  const statusFilter = params.status ?? "all";
  const searchQuery = (params.q ?? "").trim().toLowerCase();

  let tournaments: TournamentRow[] = [];
  let completedCount = 0;
  try {
    const all = await prisma.tournament.findMany({
      orderBy: { startDate: "asc" },
      include: { _count: { select: { teams: true, players: true } } },
    });
    let filtered = all.filter((t) => {
      if (showAll) return true; // show both tours
      if (showWomen) return t.tour === "lpga";
      return t.tour !== "lpga"; // men's (default)
    });
    // Year filter
    if (activeYear !== "all") {
      filtered = filtered.filter((t) => new Date(t.startDate).getFullYear().toString() === activeYear);
    }
    // Count completed BEFORE filtering them out (for toggle label)
    completedCount = filtered.filter((t) => t.status === "completed").length;
    // Apply status filter
    if (statusFilter === "live") {
      filtered = filtered.filter((t) => t.status === "in_progress");
    } else if (statusFilter === "upcoming") {
      const upcoming = filtered.filter((t) => t.status !== "completed");
      // If no upcoming tournaments exist, fall back to showing all (don't show empty page)
      filtered = upcoming.length > 0 ? upcoming : filtered;
    }
    // statusFilter === "all" → no filtering
    // Strict chronological order (earliest first)
    tournaments = [...filtered].sort((a, b) => a.startDate.getTime() - b.startDate.getTime()) as TournamentRow[];
  } catch {}

  const categoryKeys = showWomen ? ["all", "lpga_major", "major"] : showAll ? ["all", "major", "signature", "playoff", "dpwt", "regular", "lpga_major"] : ["all", "major", "signature", "playoff", "dpwt", "regular"];
  const categoryCounts: Record<string, number> = {};
  for (const t of tournaments) categoryCounts[t.category] = (categoryCounts[t.category] ?? 0) + 1;

  // Detect available years
  const yearSet = new Set<number>();
  for (const t of tournaments) yearSet.add(new Date(t.startDate).getFullYear());
  const years = Array.from(yearSet).sort((a, b) => a - b);

  // Apply category filter
  let visibleTournaments = activeCategory === "all" ? tournaments : tournaments.filter((t) => t.category === activeCategory);

  // Apply search filter
  const isSearching = searchQuery.length > 0;
  if (isSearching) {
    visibleTournaments = visibleTournaments.filter((t) =>
      t.name.toLowerCase().includes(searchQuery) ||
      (t.course ?? "").toLowerCase().includes(searchQuery)
    );
  }

  // Fetch winners for completed tournaments
  const completedIds = tournaments.filter(t => t.status === "completed").map(t => t.id);
  const winnerMap = new Map<string, { name: string; toPar: number }>();
  if (completedIds.length > 0) {
    const winners = await prisma.$queryRawUnsafe(`
      SELECT s."tournamentId", p.name AS "playerName",
             SUM(s.strokes) AS total,
             s2.par
      FROM "Score" s
      JOIN "Player" p ON p.id = s."playerId"
      JOIN "Tournament" s2 ON s2.id = s."tournamentId"
      WHERE s."tournamentId" = ANY($1::text[]) AND s.strokes IS NOT NULL
      GROUP BY s."tournamentId", p.id, s2.par
      HAVING COUNT(s.strokes) >= 3
      ORDER BY s."tournamentId", SUM(s.strokes) ASC
    `, completedIds) as { tournamentId: string; playerName: string; total: number; par: number }[];
    
    // Take first winner per tournament
    for (const w of winners) {
      if (!winnerMap.has(w.tournamentId)) {
        winnerMap.set(w.tournamentId, { name: w.playerName, toPar: Number(w.total) - Number(w.par) * 4 });
      }
    }
  }

  // Group by month for display
  const monthLabels = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const grouped: { label: string; items: TournamentRow[] }[] = [];
  for (const t of visibleTournaments) {
    const d = new Date(t.startDate);
    const label = `${monthLabels[d.getMonth()]} ${d.getFullYear()}`;
    const existing = grouped.find((g) => g.label === label);
    if (existing) existing.items.push(t);
    else grouped.push({ label, items: [t] });
  }

  function buildHref(t: string, c: string, y: string, s: string = statusFilter) {
    const p = new URLSearchParams();
    if (t === "all") p.set("tour", "all");
    else if (t === "women") p.set("tour", "women");
    // men's = no param (default)
    if (c !== "all") p.set("cat", c);
    if (y !== "all") p.set("year", y);
    if (s !== "all") p.set("status", s);
    if (isSearching) p.set("q", searchQuery);
    const qs = p.toString();
    return `/tournaments${qs ? `?${qs}` : ""}`;
  }

  // Status filter config
  const statusOptions = [
    { key: "upcoming", label: "Upcoming" },
    { key: "live", label: "Live" },
    { key: "all", label: "All" },
  ] as const;

  return (
    <Suspense fallback={<TournamentListSkeleton />}>
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
        {/* Header */}
        <div className="mb-3">
          <h1 className="text-xl font-bold tracking-tight text-[#0a3d2a] dark:text-green-400 sm:text-2xl">Tournaments</h1>
          <p className="mt-0.5 text-xs text-zinc-500">{visibleTournaments.length} {showAll ? "" : showWomen ? "women's " : "men's "}events</p>
        </div>

        {/* Tour toggle — All / Men's / Women's */}
        <div className="mt-2 flex gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-0.5">
          <Link href={buildHref("all", activeCategory, activeYear)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${showAll ? "bg-[#0a3d2a] text-white shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}>
            <TrophyIcon className="h-4 w-4" /> All
          </Link>
          <Link href={buildHref("men", activeCategory, activeYear)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${showMen ? "bg-[#0a3d2a] text-white shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}>
            <GolfFlagIcon className="h-4 w-4" /> Men&apos;s
          </Link>
          <Link href={buildHref("women", activeCategory, activeYear)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${showWomen ? "bg-[#0a3d2a] text-white shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}>
            <StarIcon className="h-4 w-4" /> Women&apos;s
          </Link>
        </div>

        {/* Filters row: categories + year */}
        <div className="mt-3 mb-4 flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {categoryKeys.map((catKey) => {
              const catCfg = catKey === "all" ? null : CATEGORY_CONFIG[catKey];
              const label = catKey === "all" ? "All" : catCfg?.label ?? catKey;
              const count = catKey === "all" ? tournaments.length : categoryCounts[catKey] ?? 0;
              if (count === 0 && catKey !== "all") return null;
              const isActive = activeCategory === catKey;
              return (
                <Link key={catKey} href={buildHref(tour, catKey, activeYear)}>
                  <span className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${isActive ? "bg-[#0a3d2a] text-white" : "bg-white text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"}`}>
                    {label}{count > 0 && <span className={`ml-1.5 ${isActive ? "text-white/60" : "text-zinc-400"}`}>{count}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
          {years.length > 1 && (
            <div className="ml-auto flex shrink-0 gap-1">
              <Link href={buildHref(tour, activeCategory, "all")}>
                <span className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${activeYear === "all" ? "bg-[#c8a951] text-[#1a1a1a]" : "text-zinc-500 hover:text-zinc-800 border border-zinc-200 dark:border-zinc-800"}`}>All Years</span>
              </Link>
              {years.map((y) => (
                <Link key={y} href={buildHref(tour, activeCategory, y.toString())}>
                  <span className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${activeYear === y.toString() ? "bg-[#c8a951] text-[#1a1a1a]" : "text-zinc-500 hover:text-zinc-800 border border-zinc-200 dark:border-zinc-800"}`}>{y}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Status filter chips: Upcoming / Live / All */}
        <div className="mt-3 flex items-center gap-1.5">
          {statusOptions.map((opt) => {
            const isActive = statusFilter === opt.key;
            return (
              <Link key={opt.key} href={buildHref(tour, activeCategory, activeYear, opt.key)}>
                <span className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${isActive ? "bg-[#0a3d2a] text-white" : "bg-white text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"}`}>
                  {opt.label}
                </span>
              </Link>
            );
          })}
          {statusFilter === "all" && completedCount > 0 && !isSearching && (
            <span className="ml-auto text-xs text-zinc-400">{completedCount} completed</span>
          )}
        </div>

        {/* Search input — client-side filter via debounce redirect */}
        <TournamentSearch
          defaultValue={searchQuery}
          baseUrl="/tournaments"
          baseParams={{ tour, cat: activeCategory, year: activeYear, status: statusFilter }}
        />

        {/* Tournament list — grouped by month */}
        {visibleTournaments.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <ChartBarIcon className="mx-auto h-8 w-8 text-zinc-300" />
            <p className="mt-3 text-sm font-semibold text-zinc-600">
              {statusFilter === "live" ? "No live tournaments right now" : statusFilter === "all" ? "No tournaments found" : "No upcoming tournaments"}
            </p>
            <p className="mt-1 text-xs text-zinc-400">Try a different filter, category, or year.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.label}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-400">{group.label}</h2>
                <div className="space-y-2">
                  {group.items.map((t) => {
                    const status = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.upcoming;
                    const canEnter = t.status === "entries_open" || t.status === "upcoming";
                    const isLive = t.status === "in_progress";
                    const cat = CATEGORY_CONFIG[t.category];
                    const potValue = t.entryFee * t._count.teams;
                    const daysUntil = Math.ceil((t.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

                    return (
                      <Link
                        key={t.id}
                        href={`/tournaments/${t.id}`}
                        className="group flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 transition hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-md sm:gap-4 sm:p-3"
                      >
                        {/* Thumbnail */}
                        <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-lg sm:h-[72px] sm:w-[96px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={courseImage(t.id, t.course)} alt={t.course || t.name} loading="lazy" className="h-full w-full object-cover" />
                          {isLive && (
                            <div className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-[#c44545] px-1 py-0.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                              <span className="text-[9px] font-bold text-white">LIVE</span>
                            </div>
                          )}
                        </div>

                        {/* Data */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-bold text-zinc-900 dark:text-white group-hover:text-[#0a3d2a] dark:group-hover:text-green-400">{t.name}</h3>
                            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${status.badgeClass}`}>{status.label}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                            <MapPinIcon className="h-3 w-3 shrink-0 text-zinc-400" />
                            <span className="truncate">{t.course ?? "TBD"}</span>
                            <span className="text-zinc-300 dark:text-zinc-600">·</span>
                            <span className="whitespace-nowrap tabular">{formatDateRange(t.startDate, t.endDate)}</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-3 text-xs">
                            <span className="inline-flex items-center gap-1">
                              <UsersIcon className="h-3 w-3 text-zinc-400" />
                              <span className="font-bold tabular text-zinc-700 dark:text-zinc-300">{t._count.teams}</span>
                              <span className="text-zinc-400">teams</span>
                            </span>
                            <span className="text-zinc-300 dark:text-zinc-700">|</span>
                            <span className="inline-flex items-center gap-1">
                              <PoundIcon className="h-3 w-3 text-[#c8a951]" />
                              <span className="font-bold tabular text-[#c8a951]">£{(t.entryFee / 100).toFixed(0)}</span>
                            </span>
                            {potValue > 0 && (
                              <>
                                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                                <span className="text-zinc-500 dark:text-zinc-400 tabular">Pot £{(potValue / 100).toFixed(0)}</span>
                              </>
                            )}
                            {cat && (
                              <>
                                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                                <span className="text-zinc-500 dark:text-zinc-400">{cat.label}</span>
                              </>
                            )}
                          </div>
                          {canEnter && daysUntil > 0 && daysUntil < 60 && (
                            <div className="mt-1 text-[11px] font-medium text-[#0a3d2a] dark:text-green-400">
                              Starts in {daysUntil} day{daysUntil === 1 ? "" : "s"}
                            </div>
                          )}
                          {t.status === "completed" && (() => {
                            const winner = winnerMap.get(t.id);
                            if (!winner) return null;
                            return (
                              <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[#c8a951]">
                                <span>🏆</span>
                                <span className="truncate font-semibold">{winner.name}</span>
                                <span className="text-red-600 dark:text-red-400">({toParDisplay(winner.toPar)})</span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* CTA */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          {canEnter && t._count.players > 0 ? (
                            <span className="rounded-lg bg-[#0a3d2a] dark:bg-green-600 px-3 py-1.5 text-xs font-bold text-white transition group-hover:bg-[#1a5c3e]">Enter</span>
                          ) : canEnter && t._count.players === 0 ? (
                            <span className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-400">Field TBA</span>
                          ) : (
                            <span className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-500">View</span>
                          )}
                          <div className={`flex h-7 w-7 items-center justify-center rounded-md transition ${canEnter ? "bg-[#0a3d2a]/10 dark:bg-green-600/20 group-hover:bg-[#0a3d2a]/20" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                            <svg className={`h-3.5 w-3.5 ${canEnter ? "text-[#0a3d2a] dark:text-green-400" : "text-zinc-400"}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Suspense>
  );
}
