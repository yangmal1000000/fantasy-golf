import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ROCKET_BETA_TOURNAMENT_ID,
  getRocketBetaStateForUser,
} from "@/lib/rocket-beta";
import TeamEntryForm from "../../../enter/TeamEntryForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Edit Rocket Team — Fantasy Golf",
  description: "Update your Rocket Classic team before first tee.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function EditRocketTeamPage({
  params,
}: {
  params: Promise<{ id: string; teamId: string }>;
}) {
  const [{ id: tournamentId, teamId }, user] = await Promise.all([
    params,
    getCurrentUser(),
  ]);
  if (!user || tournamentId !== ROCKET_BETA_TOURNAMENT_ID) notFound();

  const [tournament, team, betaState] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        players: {
          include: { player: true },
          orderBy: { player: { dataGolfRank: "asc" } },
        },
      },
    }),
    prisma.team.findFirst({
      where: { id: teamId, userId: user.id, tournamentId },
      include: {
        selections: {
          include: { tournamentPlayer: true },
        },
      },
    }),
    getRocketBetaStateForUser(user),
  ]);

  if (
    !tournament ||
    !team ||
    !betaState.approved ||
    betaState.passState !== "REDEEMED" ||
    betaState.teamId !== team.id
  ) {
    notFound();
  }

  const canEdit =
    betaState.campaignStatus === "OPEN" &&
    betaState.fieldReady &&
    (!betaState.entryClosesAt ||
      new Date() < new Date(betaState.entryClosesAt));

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
            Rocket team locked
          </p>
          <h1 className="mt-3 text-2xl font-black text-zinc-900 dark:text-white">
            Team changes are closed
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Confirmed Rocket teams lock at the official first tee.
          </p>
          <Link
            href={`/tournaments/${tournamentId}/teams/${team.id}`}
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#0a3d2a] px-5 py-3 text-sm font-black text-white"
          >
            View my team →
          </Link>
        </div>
      </div>
    );
  }

  const activePlayers = tournament.players.filter((player) => !player.withdrew);
  const activePlayerIds = new Set(activePlayers.map((player) => player.id));
  const playersByTier: Record<string, typeof activePlayers> = {};
  for (const player of activePlayers) {
    if (!playersByTier[player.tier]) playersByTier[player.tier] = [];
    playersByTier[player.tier].push(player);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/tournaments/${tournamentId}/teams/${team.id}`}
          className="text-sm font-bold text-zinc-500 hover:text-[#0a3d2a] dark:text-zinc-400 dark:hover:text-green-400"
        >
          ← Back to confirmed team
        </Link>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
          Before first tee
        </p>
        <h1 className="mt-1 text-3xl font-black text-[#0a3d2a] dark:text-green-400">
          Edit your Rocket team
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          Change the team name or any golfer. Review and save all five tiers
          together; your Test Pass remains linked to this entry.
        </p>
      </div>

      <TeamEntryForm
        tournamentId={tournament.id}
        entryFee={tournament.entryFee}
        betaMode
        fieldRelativeTiers
        initialTeam={{
          id: team.id,
          name: team.name,
          selections: Object.fromEntries(
            team.selections
              .filter((selection) =>
                activePlayerIds.has(selection.tournamentPlayerId),
              )
              .map((selection) => [
                selection.tournamentPlayer.tier,
                selection.tournamentPlayerId,
              ]),
          ),
        }}
        playersByTier={Object.fromEntries(
          Object.entries(playersByTier).map(([tier, players]) => [
            tier,
            players.map((entry) => ({
              tournamentPlayerId: entry.id,
              playerId: entry.playerId,
              name: entry.player.name,
              country: entry.player.country,
              photoUrl: entry.player.photoUrl,
              dataGolfRank: entry.player.dataGolfRank,
              tier: entry.tier,
            })),
          ]),
        )}
      />
    </div>
  );
}
