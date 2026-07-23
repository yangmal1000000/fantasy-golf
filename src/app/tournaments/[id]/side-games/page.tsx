import { prisma } from "@/lib/prisma";
import { ensureDefaultSidePots, getSideBetCount } from "@/lib/sidegames";
import { formatGBP } from "@/lib/ui";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ROCKET_BETA_TOURNAMENT_ID } from "@/lib/rocket-beta";

export const metadata = {
  title: "Side Games · Fantasy Golf",
};

const GAME_CONFIG = [
  {
    type: "top_golfer",
    title: "Top Golfer Challenge",
    icon: "",
    description: "Pick ONE golfer to shoot the lowest 4-round total",
    accent: "from-purple-500 to-purple-700",
    badge: "bg-purple-100 text-purple-700 border-purple-300",
    cardBorder: "border-purple-300",
    cardBg: "bg-purple-50/50",
  },
  {
    type: "best_round",
    title: "Best Round Prize",
    icon: "",
    description: "Lowest team score in a single round wins",
    accent: "from-amber-500 to-amber-700",
    badge: "bg-amber-100 text-amber-700 border-amber-300",
    cardBorder: "border-amber-300",
    cardBg: "bg-amber-50/50",
  },
  {
    type: "dark_horse",
    title: "Dark Horse Challenge",
    icon: "",
    description: "Pick a Tier 5 golfer (rank 51+) to outperform",
    accent: "from-fuchsia-500 to-fuchsia-700",
    badge: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300",
    cardBorder: "border-fuchsia-300",
    cardBg: "bg-fuchsia-50/50",
  },
];

export default async function SideGamesHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id === ROCKET_BETA_TOURNAMENT_ID) notFound();

  const tournament = await prisma.tournament.findUnique({
    where: { id },
  });

  if (!tournament) notFound();

  // Ensure side pots exist
  await ensureDefaultSidePots(id);

  const sidePots = await prisma.tournamentSidePot.findMany({
    where: { tournamentId: id },
  });

  // Get entry counts and prize pools
  const gameData = await Promise.all(
    GAME_CONFIG.map(async (game) => {
      const pot = sidePots.find((p) => p.type === game.type);
      const entries = await getSideBetCount(id, game.type);
      const prizePool = entries * (pot?.entryFee ?? 500);
      return { ...game, pot, entries, prizePool };
    })
  );

  const totalSidePot = gameData.reduce((sum, g) => sum + g.prizePool, 0);

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
      {/* Breadcrumb */}
      <div className="mb-3 text-sm text-zinc-500 dark:text-zinc-400 sm:mb-4">
        <Link href={`/tournaments/${id}`} className="hover:text-purple-600">
          ← {tournament.name}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-5 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-xl font-bold text-purple-700 dark:text-purple-400 sm:text-2xl">
            🎰 Side Games
          </h1>
          <span className="rounded-full border border-purple-300 bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
            Side Bets
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Skill-based bonus competitions — test your knowledge against the field
        </p>
      </div>

      {/* Total Pot Banner */}
      <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 p-4 text-white shadow-lg sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-purple-100">
              Total Side Pot
            </p>
            <p className="text-2xl font-bold sm:text-3xl">{formatGBP(totalSidePot)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-purple-100">
              Total Entries
            </p>
            <p className="text-2xl font-bold sm:text-3xl">
              {gameData.reduce((s, g) => s + g.entries, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Game Cards */}
      <div className="space-y-3 sm:space-y-4">
        {gameData.map((game) => (
          <Link
            key={game.type}
            href={`/tournaments/${id}/side-games/${game.type.replace("_", "-")}`}
            className={`block overflow-hidden rounded-2xl border-2 ${game.cardBorder} ${game.cardBg} dark:bg-zinc-900 shadow-sm transition hover:shadow-md`}
          >
            <div className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
              {/* Icon */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${game.accent} text-xl shadow sm:h-12 sm:w-12 sm:text-2xl`}
              >
                {game.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 sm:text-lg">
                    {game.title}
                  </h2>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${game.badge}`}
                  >
                    {formatGBP(game.pot?.entryFee ?? 500)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {game.description}
                </p>

                {/* Stats */}
                <div className="mt-2 flex gap-3 sm:gap-4">
                  <div>
                    <span className="text-xs text-zinc-500">Entries </span>
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">
                      {game.entries}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">Pool </span>
                    <span className="font-bold text-purple-700 dark:text-purple-400">
                      {game.prizePool > 0 ? formatGBP(game.prizePool) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="shrink-0 self-center text-purple-400">→</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 sm:mt-6">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          💡 <strong>Skill-based competition:</strong> Side games reward golf
          knowledge and smart picks — just like the main event. No luck, just
          judgement.
        </p>
      </div>
    </div>
  );
}
