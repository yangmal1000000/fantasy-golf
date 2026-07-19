import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Tournaments — Fantasy Golf",
  description: "Browse and enter upcoming fantasy golf tournaments.",
};
import { formatDateRange, STATUS_CONFIG, courseImage, CATEGORY_CONFIG } from "@/lib/ui";
import CountdownTimer from "@/components/CountdownTimer";
import { Suspense } from "react";
import { TournamentListSkeleton } from "@/components/Skeletons";
import { GolfFlagIcon, MapPinIcon, UsersIcon, PoundIcon, ChartBarIcon, StarIcon } from "@/components/icons";

type TournamentRow = {
  id: string; name: string; course: string | null;
  startDate: Date; endDate: Date; status: string; par: number;
  entryFee: number; currentRound: number; category: string; tour: string;
  _count: { teams: number; players: number };
};

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<{ tour?: string; cat?: string; year?: string; past?: string }> }) {
  const params = await searchParams;
  const tour = params.tour ?? "men";
  const showWomen = tour === "women";
  const activeCategory = params.cat ?? "all";
  const activeYear = params.year ?? "all";
  const showPast = params.past === "1";

  let tournaments: TournamentRow[] = [];
  let completedCount = 0;
  try {
    const all = await prisma.tournament.findMany({
      orderBy: { startDate: "asc" },
      include: { _count: { select: { teams: true, players: true } } },
    });
    let filtered = all.filter((t) => (showWomen ? t.tour === "lpga" : t.tour !== "lpga"));
    // Year filter
    if (activeYear !== "all") {
      filtered = filtered.filter((t) => new Date(t.startDate).getFullYear().toString() === activeYear);
    }
    // Count completed BEFORE filtering them out (for toggle label)
    completedCount = filtered.filter((t) => t.status === "completed").length;
    // Hide completed tournaments by default; show when ?past=1
    if (!showPast) {
      filtered = filtered.filter((t) => t.status !== "completed");
    }
    // Strict chronological order (earliest first)
    tournaments = [...filtered].sort((a, b) => a.startDate.getTime() - b.startDate.getTime()) as TournamentRow[];
  } catch {}

  const categoryKeys = showWomen ? ["all", "lpga_major", "major"] : ["all", "major", "signature", "playoff", "dpwt", "regular"];
  const categoryCounts: Record<string, number> = {};
  for (const t of tournaments) categoryCounts[t.category] = (categoryCounts[t.category] ?? 0) + 1;

  // Detect available years
  const yearSet = new Set<number>();
  for (const t of tournaments) yearSet.add(new Date(t.startDate).getFullYear());
  const years = Array.from(yearSet).sort((a, b) => a - b);

  // Apply category filter (tournaments already has past-filter applied above)
  const visibleTournaments = activeCategory === "all" ? tournaments : tournaments.filter((t) => t.category === activeCategory);

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

  function buildHref(t: string, c: string, y: string, p?: string) {
    const params = new URLSearchParams();
    if (t !== "men") params.set("tour", t);
    if (c !== "all") params.set("cat", c);
    if (y !== "all") params.set("year", y);
    if (p === "1") params.set("past", "1");
    const qs = params.toString();
    return `/tournaments${qs ? `?${qs}` : ""}`;
  }

  return (
    <Suspense fallback={<TournamentListSkeleton />}>
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
        {/* Header */}
        <div className="mb-3">
          <h1 className="text-xl font-bold tracking-tight text-[#0a3d2a] dark:text-green-400 sm:text-2xl">Tournaments</h1>
          <p className="mt-0.5 text-xs text-zinc-500">{visibleTournaments.length} {showWomen ? "women's" : "men's"} events</p>
        </div>

        {/* Tour toggle */}
        <div className="mt-2 flex gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-0.5">
          <Link href={buildHref("men", activeCategory, activeYear, showPast ? "1" : undefined)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${!showWomen ? "bg-[#0a3d2a] text-white shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}>
            <GolfFlagIcon className="h-4 w-4" /> Men&apos;s
          </Link>
          <Link href={buildHref("women", activeCategory, activeYear, showPast ? "1" : undefined)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${showWomen ? "bg-[#0a3d2a] text-white shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}>
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
                <Link key={catKey} href={buildHref(tour, catKey, activeYear, showPast ? "1" : undefined)}>
                  <span className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${isActive ? "bg-[#0a3d2a] text-white" : "bg-white text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"}`}>
                    {label}{count > 0 && <span className={`ml-1.5 ${isActive ? "text-white/60" : "text-zinc-400"}`}>{count}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
          {years.length > 1 && (
            <div className="ml-auto flex shrink-0 gap-1">
              <Link href={buildHref(tour, activeCategory, "all", showPast ? "1" : undefined)}>
                <span className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${activeYear === "all" ? "bg-[#c8a951] text-[#1a1a1a]" : "text-zinc-500 hover:text-zinc-800 border border-zinc-200 dark:border-zinc-800"}`}>All Years</span>
              </Link>
              {years.map((y) => (
                <Link key={y} href={buildHref(tour, activeCategory, y.toString(), showPast ? "1" : undefined)}>
                  <span className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${activeYear === y.toString() ? "bg-[#c8a951] text-[#1a1a1a]" : "text-zinc-500 hover:text-zinc-800 border border-zinc-200 dark:border-zinc-800"}`}>{y}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Show/Hide Past Events toggle */}
        {completedCount > 0 && (
          <div className="mb-3 flex justify-end">
            <Link href={buildHref(tour, activeCategory, activeYear, showPast ? undefined : "1")}>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 transition hover:border-zinc-400 dark:hover:border-zinc-600">
                {showPast ? (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    Hide Past Events
                  </>
                ) : (
                  <>
                    Show Past Events ({completedCount})
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </>
                )}
              </span>
            </Link>
          </div>
        )}

        {/* Tournament list — grouped by month */}
        {visibleTournaments.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <ChartBarIcon className="mx-auto h-8 w-8 text-zinc-300" />
            <p className="mt-3 text-sm font-semibold text-zinc-600">No tournaments found</p>
            <p className="mt-1 text-xs text-zinc-400">Try a different category or year.</p>
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
                          <img src={courseImage(t.id)} alt={t.course || t.name} loading="lazy" className="h-full w-full object-cover" />
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
                                <span className="text-zinc-500 dark:text-zinc-400 tabular">Pot £{potValue.toLocaleString()}</span>
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
                        </div>

                        {/* CTA */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          {canEnter ? (
                            <span className="rounded-lg bg-[#0a3d2a] dark:bg-green-600 px-3 py-1.5 text-xs font-bold text-white transition group-hover:bg-[#1a5c3e]">Enter</span>
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
