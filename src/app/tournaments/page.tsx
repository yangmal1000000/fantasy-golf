import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Tournaments — Fantasy Golf",
  description: "Browse and enter upcoming fantasy golf tournaments. The Open Championship 2026 at Royal Birkdale.",
};
import { formatDateRange, STATUS_CONFIG, courseImage, CATEGORY_CONFIG } from "@/lib/ui";
import CountdownTimer from "@/components/CountdownTimer";
import { Suspense } from "react";
import { TournamentListSkeleton } from "@/components/Skeletons";
import { GolfFlagIcon, MapPinIcon, ChartBarIcon, StarIcon, IconByName, UsersIcon, PoundIcon } from "@/components/icons";

type TournamentRow = {
  id: string;
  name: string;
  course: string | null;
  startDate: Date;
  endDate: Date;
  status: string;
  par: number;
  entryFee: number;
  currentRound: number;
  category: string;
  tour: string;
  _count: { teams: number; players: number };
};

/** Tour tab — compact, text-led */
function TourTab({ label, icon, active, href }: { label: string; icon: React.ReactNode; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-[#0a3d2a] text-white"
          : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tour?: string; cat?: string }>;
}) {
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

  // Category chips
  const categoryKeys = showWomen
    ? ["all", "lpga_major", "major"]
    : ["all", "major", "signature", "playoff", "dpwt"];

  const categoryCounts: Record<string, number> = {};
  for (const t of tournaments) categoryCounts[t.category] = (categoryCounts[t.category] ?? 0) + 1;

  const visibleTournaments = activeCategory === "all" ? tournaments : tournaments.filter((t) => t.category === activeCategory);

  return (
    <Suspense fallback={<TournamentListSkeleton />}>
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
        {/* Compact header */}
        <div className="mb-4">
          <h1 className="text-xl font-bold tracking-tight text-[#0a3d2a] dark:text-green-400 sm:text-2xl">Tournaments</h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {tournaments.length} {showWomen ? "women's" : "men's"} events · Browse and enter
          </p>
        </div>

        {/* Tour tabs — minimal */}
        <div className="mb-3 flex gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 p-0.5">
          <TourTab label="Men's" icon={<GolfFlagIcon className="h-3.5 w-3.5" />} active={!showWomen} href="/tournaments?tour=men" />
          <TourTab label="Women's" icon={<StarIcon className="h-3.5 w-3.5" />} active={showWomen} href="/tournaments?tour=women" />
        </div>

        {/* Category chips — horizontal scroll, compact */}
        <div className="mb-5 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {categoryKeys.map((catKey) => {
            const catCfg = catKey === "all" ? null : CATEGORY_CONFIG[catKey];
            const label = catKey === "all" ? "All" : catCfg?.label ?? catKey;
            const count = catKey === "all" ? tournaments.length : categoryCounts[catKey] ?? 0;
            const catParam = catKey === "all" ? "" : `&cat=${catKey}`;
            const href = `/tournaments?tour=${tour}${catParam}`;
            const isActive = activeCategory === catKey;
            return (
              <Link key={catKey} href={href}>
                <span className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  isActive
                    ? "bg-[#0a3d2a] text-white"
                    : "bg-white text-zinc-500 hover:text-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800"
                }`}>
                  {label}
                  {count > 0 && <span className={`ml-1 ${isActive ? "text-white/50" : "text-zinc-400"}`}>{count}</span>}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Tournament list — Polymarket-style compact rows */}
        {visibleTournaments.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
            <ChartBarIcon className="mx-auto h-8 w-8 text-zinc-300" />
            <p className="mt-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              {tournaments.length === 0 ? `No ${showWomen ? "women's" : "men's"} tournaments` : "No tournaments in this category"}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {tournaments.length === 0 ? "Tournaments will appear here once seeded." : "Try a different category."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleTournaments.map((t) => {
              const status = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.upcoming;
              const canEnter = t.status === "entries_open" || t.status === "upcoming";
              const cat = CATEGORY_CONFIG[t.category] || CATEGORY_CONFIG.major;
              const isLive = t.status === "in_progress";

              return (
                <Link
                  key={t.id}
                  href={canEnter ? `/tournaments/${t.id}/enter` : `/tournaments/${t.id}/leaderboard`}
                  className="group block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition hover:border-zinc-300 dark:hover:border-zinc-700"
                >
                  <div className="flex items-stretch">
                    {/* Course thumbnail — compact, left */}
                    <div className="relative w-24 shrink-0 overflow-hidden rounded-l-xl sm:w-32">
                      <Image
                        src={courseImage(t.id)}
                        alt={t.course || t.name}
                        fill
                        loading="lazy"
                        className="object-cover"
                        sizes="128px"
                      />
                      {isLive && (
                        <div className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-[#c44545] px-1 py-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                          <span className="text-[9px] font-bold text-white">LIVE</span>
                        </div>
                      )}
                    </div>

                    {/* Data section — dense, right */}
                    <div className="flex-1 min-w-0 p-3">
                      {/* Row 1: Name + status */}
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="truncate text-sm font-bold text-zinc-900 dark:text-white group-hover:text-[#0a3d2a] dark:group-hover:text-green-400">
                          {t.name}
                        </h2>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${status.badgeClass}`}>
                            {status.label}
                          </span>
                        </div>
                      </div>

                      {/* Row 2: Course + date */}
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <MapPinIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{t.course ?? "TBD"}</span>
                        <span className="text-zinc-300 dark:text-zinc-600">·</span>
                        <span className="whitespace-nowrap tabular">{formatDateRange(t.startDate, t.endDate)}</span>
                      </div>

                      {/* Row 3: Stats — compact data chips */}
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                          <UsersIcon className="h-3 w-3" />
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300 tabular">{t._count.teams}</span>
                          <span className="text-zinc-400">teams</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                          <PoundIcon className="h-3 w-3 text-[#c8a951]" />
                          <span className="font-semibold text-[#c8a951] tabular">£{(t.entryFee / 100).toFixed(0)}</span>
                        </span>
                        <span className="text-zinc-400 dark:text-zinc-500 tabular">Par {t.par}</span>
                        {isLive && t.currentRound > 0 && (
                          <span className="font-semibold text-[#c44545]">R{t.currentRound}</span>
                        )}
                      </div>

                      {/* Countdown — inline, subtle */}
                      {canEnter && (
                        <div className="mt-1.5">
                          <CountdownTimer startDate={t.startDate} />
                        </div>
                      )}
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
