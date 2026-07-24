import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import SignInPrompt from "@/components/SignInPrompt";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ROCKET_BETA_TOURNAMENT_ID,
  getRocketBetaStateForUser,
} from "@/lib/rocket-beta";
import { TEAM_ENTRY_TIERS } from "@/lib/team-entry-validation";
import { formatDateRange } from "@/lib/ui";
import TeamEntryForm from "../enter/TeamEntryForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Rocket Team Dry Run — Fantasy Golf",
  description:
    "Protected, non-consuming rehearsal of the Rocket Classic team entry flow.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function EnterTeamPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id !== ROCKET_BETA_TOURNAMENT_ID) notFound();

  const [tournament, user] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id },
      include: {
        players: {
          where: { withdrew: false },
          include: { player: true },
          orderBy: { player: { dataGolfRank: "asc" } },
        },
      },
    }),
    getCurrentUser(),
  ]);
  if (!tournament) notFound();

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <SignInPrompt
          title="Rocket team-entry dry run"
          message="Sign in with Harry's coordinator account and unlocked Test Pass."
        />
      </div>
    );
  }
  if (!user.isAdmin) notFound();

  const betaState = await getRocketBetaStateForUser(user);
  if (!betaState.approved) notFound();
  if (betaState.passState === "LOCKED") redirect("/target");
  if (betaState.passState === "REDEEMED" && betaState.teamId) {
    redirect(`/tournaments/${id}/teams/${betaState.teamId}`);
  }
  if (betaState.fieldReady) redirect(`/tournaments/${id}/enter`);

  const playersByTier = Object.fromEntries(
    TEAM_ENTRY_TIERS.map((tier) => [
      tier,
      tournament.players
        .filter((entry) => entry.tier === tier)
        .map((entry) => ({
          tournamentPlayerId: entry.id,
          playerId: entry.playerId,
          name: entry.player.name,
          country: entry.player.country,
          photoUrl: entry.player.photoUrl,
          dataGolfRank: entry.player.dataGolfRank,
          tier: entry.tier,
        })),
    ]),
  );
  if (
    TEAM_ENTRY_TIERS.some((tier) => playersByTier[tier].length === 0)
  ) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a] sm:text-xs">
          Test Pass dry run
        </p>
        <h1 className="mt-1 text-2xl font-black text-[#0a3d2a] dark:text-green-400">
          {tournament.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {tournament.course} ·{" "}
          {formatDateRange(tournament.startDate, tournament.endDate)} · Par{" "}
          {tournament.par}
        </p>
      </div>

      <section className="mb-5 overflow-hidden rounded-2xl border border-[#c8a951]/40 bg-[#071f16] text-white shadow-lg sm:mb-7">
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c8a951] text-lg font-black text-[#17251d]">
            ✓
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#e4cc85]">
              Provisional field · rehearsal only
            </p>
            <h2 className="mt-1 text-lg font-black">
              Your real Test Pass will not be used
            </h2>
            <p className="mt-1 text-sm leading-5 text-white/70">
              Pick one golfer from each provisional tier, review the team and
              complete the dry run. No team, selection count or notification
              will be created.
            </p>
          </div>
        </div>
        <div className="border-t border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/60 sm:px-5">
          {tournament.players.length} provisional players · real pass status:
          unlocked
        </div>
      </section>

      <TeamEntryForm
        tournamentId={tournament.id}
        entryFee={tournament.entryFee}
        betaMode
        dryRunMode
        fieldRelativeTiers={betaState.provisionalFieldReady}
        playersByTier={playersByTier}
        savedTeams={[]}
      />
    </div>
  );
}
