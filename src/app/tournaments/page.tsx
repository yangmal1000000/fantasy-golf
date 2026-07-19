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
import { GolfFlagIcon, MapPinIcon, UsersIcon, PoundIcon, ChartBarIcon, StarIcon, IconByName } from "@/components/icons";

type TournamentRow = {
  id: string; name: string; course: string | null;
  startDate: Date; endDate: Date; status: string; par: number;
  entryFee: number; currentRound: number; category: string; tour: string;
  _count: { teams: number; players: number };
};

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<{ tour?: string; cat?: string }> }) {
  const params = await searchParams;
  const tour = params.tour ?? "men";
  const showWomen = tour === "women";
  const activeCategory = params.cat ?? "all";

  let tournaments: TournamentRow[] = [];
  try {
    const all = await prisma.tournament.findMany({
      orderBy: { startDate: "asc" },
      include: { _count: { select: { teams: true, players: true } } },
    });
    const filtered = all.filter((t) => (showWomen ? t.tour === "lpga" : t.tour !== "lpga"));
    const now = Date.now();
    tournaments = [...filtered].sort((a, b) => {
      if (a.status === "in_progress" && b.status !== "in_progress") return -1;
      if (b.status === "in_progress" && a.status !== "in_progress") return 1;
      return Math.abs(a.startDate.getTime() - now) - Math.abs(b.startDate.getTime() - now);
    }) as TournamentRow[];
  } catch {}

  const categoryKeys = showWomen ? ["all", "lpga_major", "major"] : ["all", "major", "signature", "playoff", "dpwt"];
  const categoryCounts: Record<string, number> = {};
  for (const t of tournaments) categoryCounts[t.category] = (categoryCounts[t.category] ?? 0) + 1;
  const visibleTournaments = activeCategory === "all" ? tournaments : tournaments.filter((t) => t.category === activeCategory);

  return (
    <Suspense fallback={<TournamentListSkeleton />}>
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#0a3d2a] dark:text-green-400 sm:text-2xl">Tournaments</h1>
            <p className="mt-0.5 text-xs text-zinc-500">{tournaments.length} {showWomen ? "women's" : "men's"} events</p>
          </div>
        </div>

        {/* Tour toggle — compact */}
        <div className="mt-2 flex gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-0.5">
          <Link href="/tournaments?tour=men" className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${!showWomen ? "bg-[#0a3d2a] text-white shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}>
            <GolfFlagIcon className="h-4 w-4" /> Men&apos;s
          </Link>
          <Link href="/tournaments?tour=women" className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${showWomen ? "bg-[#0a3d2a] text-white shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}>
            <StarIcon className="h-4 w-4" /> Women&apos;s
          </Link>
        </div>

        {/* Category chips — stronger */}
        <div className="mt-3 mb-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {categoryKeys.map((catKey) => {
            const catCfg = catKey === "all" ? null : CATEGORY_CONFIG[catKey];
            const label = catKey === "all" ? "All" : catCfg?.label ?? catKey;
            const count = catKey === "all" ? tournaments.length : categoryCounts[catKey] ?? 0;
            const catParam = catKey === "all" ? "" : `&cat=${catKey}`;
            const isActive = activeCategory === catKey;
            return (
              <Link key={catKey} href={`/tournaments?tour=${tour}${catParam}`}>
                <span className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${isActive ? "bg-[#0a3d2a] text-white" : "bg-white text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700"}`}>
                  {label}{count > 0 && <span className={`ml-1.5 ${isActive ? "text-white/60" : "text-zinc-400"}`}>{count}</span>}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Tournament list */}
        {visibleTournaments.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <ChartBarIcon className="mx-auto h-8 w-8 text-zinc-300" />
            <p className="mt-3 text-sm font-semibold text-zinc-600">No tournaments available</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleTournaments.map((t) => {
              const status = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.upcoming;
              const canEnter = t.status === "entries_open" || t.status === "upcoming";
              const isLive = t.status === "in_progress";
              const cat = CATEGORY_CONFIG[t.category];
              const potValue = t.entryFee * t._count.teams;
              const daysUntil = Math.ceil((t.startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

              return (
                <Link
                  key={t.id}
                  href={canEnter ? `/tournaments/${t.id}/enter` : `/tournaments/${t.id}/leaderboard`}
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

                  {/* Data — fills available space */}
                  <div className="min-w-0 flex-1">
                    {/* Row 1: Name + status badge */}
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-bold text-zinc-900 dark:text-white group-hover:text-[#0a3d2a] dark:group-hover:text-green-400">{t.name}</h2>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${status.badgeClass}`}>{status.label}</span>
                    </div>

                    {/* Row 2: Course + date */}
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <MapPinIcon className="h-3 w-3 shrink-0 text-zinc-400" />
                      <span className="truncate">{t.course ?? "TBD"}</span>
                      <span className="text-zinc-300 dark:text-zinc-600">·</span>
                      <span className="whitespace-nowrap tabular">{formatDateRange(t.startDate, t.endDate)}</span>
                    </div>

                    {/* Row 3: Stats — uses remaining space well */}
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

                    {/* Countdown for open tournaments */}
                    {canEnter && daysUntil > 0 && (
                      <div className="mt-1 text-[11px] font-medium text-[#0a3d2a] dark:text-green-400">
                        Starts in {daysUntil} day{daysUntil === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>

                  {/* CTA — strong, right-aligned */}
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
        )}
      </div>
    </Suspense>
  );
}
