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
import { GolfFlagIcon, MapPinIcon, ChartBarIcon, StarIcon, IconByName } from "@/components/icons";

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

/** Tour tab with SVG icon */
function TourTab({
  label,
  icon,
  active,
  href,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition touch-target ${
        active
          ? "bg-[#0a3d2a] text-white shadow-md"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

/** Category filter chip */
function CategoryChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-[#c8a951] text-[#1a1a1a] shadow-sm"
          : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700"
      }`}
    >
      {label}
      {count != null && count > 0 && (
        <span className={`ml-1.5 ${active ? "text-[#1a1a1a]/60" : "text-zinc-400"}`}>
          {count}
        </span>
      )}
    </button>
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
      include: {
        _count: { select: { teams: true, players: true } },
      },
    });

    // Filter by tab
    const filtered = all.filter((t) =>
      showWomen ? t.tour === "lpga" : t.tour !== "lpga"
    );

    // Sort: in_progress first, then nearest to today, then past
    // eslint-disable-next-line react-hooks/purity -- server component, Date.now() is request-scoped
    const now = Date.now();
    tournaments = [...filtered].sort((a, b) => {
      if (a.status === "in_progress" && b.status !== "in_progress") return -1;
      if (b.status === "in_progress" && a.status !== "in_progress") return 1;
      return Math.abs(a.startDate.getTime() - now) - Math.abs(b.startDate.getTime() - now);
    }) as TournamentRow[];
  } catch {
    // DB not available
  }

  // Build category list based on tour
  const categoryKeys = showWomen
    ? ["all", "lpga_major", "major"]
    : ["all", "major", "signature", "playoff", "dpwt"];

  // Count per category (from the full tour-filtered list, not the category-filtered one)
  const categoryCounts: Record<string, number> = {};
  for (const t of tournaments) {
    categoryCounts[t.category] = (categoryCounts[t.category] ?? 0) + 1;
  }

  // Apply category filter
  const visibleTournaments =
    activeCategory === "all"
      ? tournaments
      : tournaments.filter((t) => t.category === activeCategory);

  return (
    <Suspense fallback={<TournamentListSkeleton />}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold text-[#0a3d2a] dark:text-green-400 sm:text-3xl">Tournaments</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Browse and enter upcoming fantasy golf tournaments.
          </p>
        </div>

        {/* Men's / Women's tabs */}
        <div className="mb-4 flex gap-2">
          <TourTab
            label="Men's"
            icon={<GolfFlagIcon className="h-4 w-4" />}
            active={!showWomen}
            href="/tournaments?tour=men"
          />
          <TourTab
            label="Women's"
            icon={<StarIcon className="h-4 w-4" />}
            active={showWomen}
            href="/tournaments?tour=women"
          />
        </div>

        {/* Category filter chips */}
        <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {categoryKeys.map((catKey) => {
            const catCfg = catKey === "all" ? null : CATEGORY_CONFIG[catKey];
            const label = catKey === "all" ? "All" : catCfg?.label ?? catKey;
            const count = catKey === "all"
              ? tournaments.length
              : categoryCounts[catKey] ?? 0;
            // Build href preserving tour param
            const catParam = catKey === "all" ? "" : `&cat=${catKey}`;
            const href = `/tournaments?tour=${tour}${catParam}`;
            return (
              <Link key={catKey} href={href}>
                <CategoryChip
                  label={label}
                  active={activeCategory === catKey}
                  count={count}
                  onClick={() => {}}
                />
              </Link>
            );
          })}
        </div>

        {visibleTournaments.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <ChartBarIcon className="mx-auto h-12 w-12 text-zinc-400" />
            <p className="mt-4 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
              {tournaments.length === 0
                ? `No ${showWomen ? "women's" : "men's"} tournaments available`
                : "No tournaments in this category"}
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {showWomen && tournaments.length === 0
                ? "Run the women's seed endpoint to add LPGA tournaments."
                : tournaments.length === 0
                  ? "Run npm run seed to set up tournaments."
                  : "Try selecting a different category filter."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:gap-6">
            {visibleTournaments.map((t) => {
              const status = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.upcoming;
              const canEnter = t.status === "entries_open" || t.status === "upcoming";
              const cat = CATEGORY_CONFIG[t.category] || CATEGORY_CONFIG.major;
              return (
                <div
                  key={t.id}
                  className="overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-md transition hover:shadow-lg card-hover"
                  style={{ boxShadow: "var(--shadow-md)" }}
                >
                  {/* Course thumbnail — 16:9 prominent banner */}
                  <div className="relative h-44 overflow-hidden sm:h-52">
                    <Image
                      src={courseImage(t.id)}
                      alt={t.course || t.name}
                      fill
                      loading="lazy"
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 768px"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a3d2a]/90 via-[#0a3d2a]/30 to-transparent" />
                    {/* Top row: badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${status.badgeClass}`}
                      >
                        {status.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cat.badgeClass}`}>
                        {cat.icon && <IconByName name={cat.icon} className="h-3 w-3" />}
                        {cat.label}
                      </span>
                    </div>
                    {/* Bottom row: tournament name (hero) + location */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <h2 className="text-lg font-bold tracking-tight drop-shadow sm:text-xl">
                        {t.name}
                      </h2>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-white/90 sm:text-sm">
                        <MapPinIcon className="h-3 w-3 inline" />
                        {t.course ?? "TBD"} · {formatDateRange(t.startDate, t.endDate)}
                      </p>
                    </div>
                    {/* Round indicator */}
                    {t.currentRound > 0 && t.status === "in_progress" && (
                      <div className="absolute top-12 right-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#c44545] px-2 py-0.5 text-[10px] font-bold text-white animate-pulse-live">
                          R{t.currentRound}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body: stats + countdown */}
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-medium">Par {t.par}</span>
                      <span className="text-zinc-300 dark:text-zinc-600">·</span>
                      <span className="font-semibold text-[#c8a951]">£{(t.entryFee / 100).toFixed(0)} entry</span>
                    </div>
                    {canEnter && (
                      <div className="mt-3">
                        <CountdownTimer startDate={t.startDate} />
                      </div>
                    )}
                  </div>

                  {/* Footer: stat chips + CTA */}
                  <div className="flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 sm:px-5 sm:py-3">
                    {/* Teams stat chip */}
                    <div className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs dark:bg-zinc-800">
                      <span className="font-bold text-[#0a3d2a] dark:text-green-400">{t._count.teams}</span>
                      <span className="text-zinc-500 dark:text-zinc-400">teams</span>
                    </div>
                    {/* Players stat chip */}
                    <div className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs dark:bg-zinc-800">
                      <span className="font-bold text-[#0a3d2a] dark:text-green-400">{t._count.players}</span>
                      <span className="text-zinc-500 dark:text-zinc-400">players</span>
                    </div>
                    <div className="flex-1" />
                    {canEnter ? (
                      <Link
                        href={`/tournaments/${t.id}/enter`}
                        className="rounded-xl bg-[#0a3d2a] px-5 py-2 text-center text-sm font-semibold text-white transition hover:bg-[#1a5c3e] touch-target"
                      >
                        Enter Team →
                      </Link>
                    ) : (
                      <Link
                        href={`/tournaments/${t.id}/leaderboard`}
                        className="rounded-xl bg-[#0a3d2a] px-5 py-2 text-center text-sm font-semibold text-white transition hover:bg-[#1a5c3e] touch-target"
                      >
                        Leaderboard →
                      </Link>
                    )}
                    <Link
                      href={`/tournaments/${t.id}/leaderboard`}
                      className="flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 p-2 text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-zinc-800 touch-target"
                      aria-label="View leaderboard"
                    >
                      <ChartBarIcon className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Suspense>
  );
}
