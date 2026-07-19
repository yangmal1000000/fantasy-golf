import { prisma } from "@/lib/prisma";
import { calculateTeamScore } from "@/lib/scoring";
import { TIER_CONFIG } from "@/lib/ui";
import { notFound } from "next/navigation";
import Link from "next/link";
import TierBadge from "@/components/TierBadge";
import PlayerAvatar from "@/components/PlayerAvatar";
import Flag from "@/components/Flag";
import Sparkline from "@/components/Sparkline";
import ShareCard from "@/components/ShareCard";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string; teamId: string }>;
}) {
  const { id: tournamentId, teamId } = await params;

  const [tournament, team] = await Promise.all([
    prisma.tournament.findUnique({ where: { id: tournamentId } }),
    prisma.team.findUnique({
      where: { id: teamId },
      include: {
        user: true,
        selections: {
          include: {
            tournamentPlayer: {
              include: { player: true },
            },
          },
        },
      },
    }),
  ]);

  if (!tournament || !team) notFound();

  // Calculate team score
  let scoreResult: Awaited<ReturnType<typeof calculateTeamScore>> | null = null;
  try {
    scoreResult = await calculateTeamScore(teamId);
  } catch {
    // scores not calculated yet
  }

  const totalPar = tournament.par * 4 * 5;
  const vsPar = scoreResult ? scoreResult.totalStrokes - totalPar : 0;

  // Build share card data
  const sharePlayers = scoreResult?.players.map((p) => ({
    playerName: p.playerName,
    tier: p.tier,
    country: null as string | null,
  })) ?? team.selections.map((sel) => ({
    playerName: sel.tournamentPlayer.player.name,
    tier: sel.tournamentPlayer.tier,
    country: sel.tournamentPlayer.player.country,
  }));

  return (
    <div className="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
      {/* Back link */}
      <div className="mb-3 sm:mb-4">
        <Link
          href={`/tournaments/${tournamentId}/leaderboard`}
          className="text-sm text-zinc-500 hover:text-[#0a3d2a] dark:text-zinc-400 dark:hover:text-green-400"
        >
          ← Leaderboard
        </Link>
      </div>

      {/* Team header */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0a3d2a] to-[#0a3d2a] p-5 text-white shadow-lg sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{team.name}</h1>
            <p className="mt-1 text-sm text-white/70">
              {team.user?.name ?? team.user?.email}
            </p>
          </div>
          {scoreResult && (
            <div className="text-right shrink-0">
              <p className="text-2xl font-extrabold text-[#c8a951] sm:text-3xl">
                {scoreResult.position || "—"}
              </p>
              <p className="text-xs text-white/60">Position</p>
            </div>
          )}
        </div>
        {scoreResult && (
          <div className="mt-4 flex gap-4 border-t border-white/20 pt-4 sm:gap-6">
            <div>
              <p className="text-xl font-bold sm:text-2xl">{scoreResult.totalStrokes}</p>
              <p className="text-xs text-white/60">Total Strokes</p>
            </div>
            <div>
              <p
                className={`text-xl font-bold sm:text-2xl ${
                  vsPar < 0
                    ? "text-red-300"
                    : vsPar === 0
                      ? "text-white"
                      : "text-white/80"
                }`}
              >
                {vsPar > 0 ? "+" : ""}
                {vsPar === 0 ? "E" : vsPar}
              </p>
              <p className="text-xs text-white/60">vs Par ({tournament.par})</p>
            </div>
            <div>
              <p className="text-xl font-bold sm:text-2xl">
                {team.paid ? "" : "⏳"}
              </p>
              <p className="text-xs text-white/60">
                {team.paid ? "Paid" : "Pending"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Share Card */}
      <div className="mt-4 sm:mt-6">
        <ShareCard
          teamName={team.name}
          tournamentName={tournament.name}
          players={sharePlayers}
          totalStrokes={scoreResult?.totalStrokes}
          position={scoreResult?.position}
        />
      </div>

      {/* Players */}
      <div className="mt-6 space-y-3 sm:space-y-4">
        <h2 className="text-lg font-bold text-[#0a3d2a] dark:text-green-400">Your Squad</h2>

        {scoreResult?.players.map((p) => {
          const config = TIER_CONFIG[p.tier] ?? TIER_CONFIG.T51_PLUS;
          // Get player country from team selections
          const sel = team.selections.find(
            (s) => s.tournamentPlayer.playerId === p.playerId
          );
          const playerCountry = sel?.tournamentPlayer.player.country ?? null;
          return (
            <div
              key={p.playerId}
              className={`rounded-2xl border-2 p-3 sm:p-4 ${config.cardClass}`}
            >
              {/* Player header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <PlayerAvatar
                    name={p.playerName}
                    country={playerCountry}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-bold text-zinc-900 dark:text-white">{p.playerName}</h3>
                      <Flag countryCode={playerCountry} size="sm" />
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <TierBadge tier={p.tier} size="sm" showLabel />
                      <Sparkline scores={p.roundScores} par={tournament.par} />
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {p.withdrew ? (
                    <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                      WD
                    </span>
                  ) : p.madeCut === false ? (
                    <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700">
                      ✗ Cut
                    </span>
                  ) : p.madeCut === true ? (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                      ✓ Cut
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Round scores — horizontal scroll on very small screens */}
              <div className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
                {[0, 1, 2, 3].map((i) => {
                  const score = p.roundScores[i];
                  const estimated = p.isEstimated[i];
                  const roundPar = tournament.par;
                  const diff = score != null ? score - roundPar : null;

                  return (
                    <div
                      key={i}
                      className="rounded-lg bg-white/70 dark:bg-zinc-800/50 p-1.5 text-center sm:p-2"
                    >
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">R{i + 1}</p>
                      <p className="text-base font-bold text-zinc-900 dark:text-white sm:text-lg">
                        {score ?? "—"}
                        {estimated && (
                          <span className="ml-0.5 text-xs text-orange-500">
                            *
                          </span>
                        )}
                      </p>
                      {diff != null && (
                        <p
                          className={`text-xs font-medium ${
                            diff < 0
                              ? "text-red-500"
                              : diff === 0
                                ? "text-zinc-500 dark:text-zinc-400"
                                : "text-zinc-400 dark:text-zinc-500"
                          }`}
                        >
                          {diff > 0 ? "+" : ""}
                          {diff === 0 ? "E" : diff}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Player total */}
              <div className="mt-2 flex items-center justify-between border-t border-white/50 dark:border-zinc-700/50 pt-2 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Total:{" "}
                  <span className="font-bold text-zinc-900 dark:text-white">
                    {p.totalStrokes}
                  </span>
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {p.roundsPlayed} rounds
                  {p.isEstimated.some((e) => e) && (
                    <span className="ml-1 text-xs text-orange-500">
                      * estimated
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        }) ??
        team.selections.map((sel) => (
          <div
            key={sel.id}
            className="rounded-2xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4"
          >
            <div className="flex items-center gap-3">
              <PlayerAvatar
                name={sel.tournamentPlayer.player.name}
                country={sel.tournamentPlayer.player.country}
                size="md"
              />
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white">
                  {sel.tournamentPlayer.player.name}
                </h3>
                <TierBadge tier={sel.tournamentPlayer.tier} size="sm" showLabel />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Estimated score note */}
      {scoreResult?.players.some((p) => p.isEstimated.some((e) => e)) && (
        <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 p-3 text-xs text-orange-700 dark:text-orange-400">
          <strong>* Estimated scores:</strong> When a player misses the cut,
          their R3 and R4 scores are estimated as the average of R1 + R2,
          rounded to the nearest whole number.
        </div>
      )}
    </div>
  );
}
