import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatDateRange, STATUS_CONFIG, courseImage, CATEGORY_CONFIG } from "@/lib/ui";
import StatusRibbon from "@/components/StatusRibbon";
import CountdownTimer from "@/components/CountdownTimer";
import { Suspense } from "react";
import { TournamentListSkeleton } from "@/components/Skeletons";

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

// Tab link rendered as a server component (no client JS for the toggle itself).
function TourTab({
  label,
  icon,
  active,
  href,
}: {
  label: string;
  icon: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition touch-target ${
        active
          ? "bg-[#0a3d2a] text-white shadow-md"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      }`}
    >
      <span className="mr-1.5">{icon}</span>
      {label}
    </Link>
  );
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tour?: string }>;
}) {
  const params = await searchParams;
  const tour = params.tour ?? "men";
  const showWomen = tour === "women";

  let tournaments: TournamentRow[] = [];

  try {
    const all = await prisma.tournament.findMany({
      orderBy: { startDate: "asc" },
      include: {
        _count: { select: { teams: true, players: true } },
      },
    });

    // Filter by tab
    const filtered = (all as any[]).filter((t) =>
      showWomen ? t.tour === "lpga" : t.tour !== "lpga"
    );

    // Sort: in_progress first, then nearest to today, then past
    const now = Date.now();
    tournaments = filtered
      .map((t) => ({ ...t, _dist: Math.abs(t.startDate.getTime() - now) }))
      .sort((a, b) => {
        if (a.status === "in_progress" && b.status !== "in_progress") return -1;
        if (b.status === "in_progress" && a.status !== "in_progress") return 1;
        return a._dist - b._dist;
      })
      .map(({ _dist, ...t }) => t) as TournamentRow[];
  } catch {
    // DB not available
  }

  return (
    <Suspense fallback={<TournamentListSkeleton />}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold text-[#0a3d2a] dark:text-green-400 sm:text-3xl">Tournaments</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Browse and enter upcoming fantasy golf tournaments.
          </p>
        </div>

        {/* Men's / Women's tabs */}
        <div className="mb-6 flex gap-2">
          <TourTab
            label="Men's"
            icon="⛳"
            active={!showWomen}
            href="/tournaments?tour=men"
          />
          <TourTab
            label="Women's"
            icon="🎀"
            active={showWomen}
            href="/tournaments?tour=women"
          />
        </div>

        {tournaments.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
            <p className="text-lg font-semibold text-zinc-700">
              No {showWomen ? "women's" : "men's"} tournaments available
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {showWomen ? (
                <>
                  Run the women's seed endpoint to add LPGA tournaments.
                </>
              ) : (
                <>
                  Run <code className="rounded bg-zinc-200 px-2 py-0.5">npm run seed</code> to set up tournaments.
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-5">
            {tournaments.map((t) => {
              const status = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.upcoming;
              const canEnter = t.status === "entries_open" || t.status === "upcoming";
              return (
                <div
                  key={t.id}
                  className="overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-md transition hover:shadow-lg"
                >
                  {/* Course thumbnail */}
                  <div className="relative h-24 overflow-hidden sm:h-32">
                    <Image
                      src={courseImage(t.id)}
                      alt={t.course || t.name}
                      fill
                      loading="lazy"
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 768px"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a3d2a]/80 to-transparent" />
                    <StatusRibbon status={t.status} />
                    <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between text-white">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.badgeClass}`}
                      >
                        {status.label}
                      </span>
                      {(() => {
                        const cat = CATEGORY_CONFIG[t.category] || CATEGORY_CONFIG.major;
                        return (
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${cat.badgeClass}`}>
                            {cat.icon} {cat.label}
                          </span>
                        );
                      })()}
                      {t.currentRound > 0 && t.status === "in_progress" && (
                        <span className="text-xs font-medium text-orange-300">Round {t.currentRound}</span>
                      )}
                    </div>
                  </div>
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-[#0a3d2a] dark:text-green-400 sm:text-xl">
                          {t.name}
                        </h2>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          📍 {t.course ?? "TBD"} · {formatDateRange(t.startDate, t.endDate)}
                        </p>
                        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-500">
                          Par {t.par} · £{(t.entryFee / 100).toFixed(0)} entry
                        </p>
                        {canEnter && (
                          <div className="mt-2">
                            <CountdownTimer startDate={t.startDate} />
                          </div>
                        )}
                      </div>
                      <div className="text-center shrink-0">
                        <p className="text-2xl font-bold text-[#0a3d2a] dark:text-green-400">
                          {t._count.teams}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">teams</p>
                      </div>
                    </div>
                  </div>
                  {/* Actions — full width on mobile */}
                  <div className="flex gap-2 border-t border-zinc-100 dark:border-zinc-800 p-3 sm:p-4">
                    {canEnter ? (
                      <Link
                        href={`/tournaments/${t.id}/enter`}
                        className="flex-1 rounded-xl bg-[#0a3d2a] py-2.5 text-center font-semibold text-white transition hover:bg-[#0a3d2a] touch-target"
                      >
                        Enter Team →
                      </Link>
                    ) : (
                      <Link
                        href={`/tournaments/${t.id}/leaderboard`}
                        className="flex-1 rounded-xl bg-[#0a3d2a] py-2.5 text-center font-semibold text-white transition hover:bg-[#0a3d2a] touch-target"
                      >
                        View Leaderboard →
                      </Link>
                    )}
                    <Link
                      href={`/tournaments/${t.id}/leaderboard`}
                      className="flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-center font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-zinc-800 touch-target"
                      aria-label="View leaderboard"
                    >
                      📊
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
