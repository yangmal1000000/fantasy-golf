import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { formatDateRange } from "@/lib/ui";
import {
  ROCKET_BETA_TOURNAMENT_ID,
  getRocketBetaStateForUser,
} from "@/lib/rocket-beta";
import TeamEntryForm from "./TeamEntryForm";
import RocketFieldOpeningCountdown from "./RocketFieldOpeningCountdown";

export const metadata: Metadata = {
  title: "Enter Team — Fantasy Golf",
  description: "Build your fantasy golf team: pick one player from each of the 5 ranking tiers.",
};
import SignInPrompt from "@/components/SignInPrompt";

export default async function EnterTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [tournament, user] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id },
      include: {
        players: {
          include: { player: true },
          orderBy: { player: { dataGolfRank: "asc" } },
        },
      },
    }),
    getCurrentUser(),
  ]);

  if (!tournament) notFound();
  const isRocketBeta = tournament.id === ROCKET_BETA_TOURNAMENT_ID;

  // Check if entries are still open
  const canEnter =
    tournament.status === "entries_open" || tournament.status === "upcoming";

  // Group players by tier
  const playersByTier: Record<string, typeof tournament.players> = {};
  for (const tp of tournament.players) {
    if (tp.withdrew) continue;
    if (!playersByTier[tp.tier]) playersByTier[tp.tier] = [];
    playersByTier[tp.tier].push(tp);
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0a3d2a]">{tournament.name}</h1>
          <p className="text-sm text-zinc-600">
            {tournament.course} · {formatDateRange(tournament.startDate, tournament.endDate)} · Par {tournament.par}
          </p>
        </div>
        <SignInPrompt
          title={isRocketBeta ? "Join the Rocket test flight" : "Sign in to Enter"}
          message={
            isRocketBeta
              ? "Continue with Google. Complete Target once to unlock your Test Pass, then return here to build your five-player team."
              : "Create your fantasy golf team by signing in with Google."
          }
        />
      </div>
    );
  }

  const betaState = isRocketBeta
    ? await getRocketBetaStateForUser(user)
    : null;
  if (betaState && !betaState.approved) notFound();
  if (betaState?.passState === "REDEEMED" && betaState.teamId) {
    redirect(`/tournaments/${tournament.id}/teams/${betaState.teamId}`);
  }

  // Fetch user's saved team templates
  const savedTeams = await prisma.savedTeam.findMany({
    where: { userId: user.id },
    include: {
      players: {
        include: {
          player: {
            select: { id: true, name: true, country: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Serialize saved teams for the client component
  const savedTeamsPreview = savedTeams.map((st) => ({
    id: st.id,
    name: st.name,
    players: st.players.map((p) => ({
      playerId: p.playerId,
      tier: p.tier,
      player: {
        id: p.player.id,
        name: p.player.name,
      },
    })),
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Tournament header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0a3d2a]">{tournament.name}</h1>
        <p className="text-sm text-zinc-600">
          {tournament.course} · {formatDateRange(tournament.startDate, tournament.endDate)} · Par {tournament.par}
        </p>
      </div>

      {!canEnter ? (
        <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-6 text-center">
          <p className="text-lg font-semibold text-orange-800">
            Entries are closed for this tournament
          </p>
          <p className="mt-1 text-sm text-orange-600">
            Status: {tournament.status.replace("_", " ")}
          </p>
        </div>
      ) : betaState?.passState === "LOCKED" ? (
        <div className="overflow-hidden rounded-3xl border border-[#c8a951]/40 bg-white shadow-xl dark:border-[#c8a951]/30 dark:bg-zinc-900">
          <div className="bg-[#0a3d2a] p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e4cc85]">
              Step 1 of 2
            </p>
            <h2 className="mt-2 text-2xl font-black">Unlock your Test Pass first</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
              Complete the three Target decisions once. Your score does not affect
              your fantasy team; completion simply unlocks one account-bound pass.
            </p>
          </div>
          <div className="p-6 sm:p-8">
            <a
              href="/target"
              className="inline-flex rounded-xl bg-[#c8a951] px-5 py-3 text-sm font-black text-[#17251d]"
            >
              Complete Target →
            </a>
          </div>
        </div>
      ) : (betaState && !betaState.fieldReady) ||
        tournament.players.length < 5 ||
        ["T1_10", "T11_20", "T21_30", "T31_50", "T51_PLUS"].some(
          (tier) => !playersByTier[tier]?.length,
        ) ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
            Test Pass ready
          </p>
          <h2 className="mt-3 text-2xl font-black text-zinc-900 dark:text-white">
            The Rocket field is being prepared
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Your pass is safely linked to this account. Team selection opens after
            the complete player field and all five tier lists have been reviewed
            and frozen.
          </p>
          {betaState?.entryOpensAt && (
            <RocketFieldOpeningCountdown
              opensAt={betaState.entryOpensAt}
              serverNow={new Date().toISOString()}
            />
          )}
          {user.isAdmin && betaState?.passState === "UNLOCKED" && (
            <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <p className="mx-auto mb-3 max-w-md text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Coordinator preview: use the provisional field to rehearse all
                five picks and confirmation. Nothing is saved and the Test Pass
                remains unlocked.
              </p>
              <a
                href={`/tournaments/${tournament.id}/enter-preview`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0a3d2a] px-5 py-3 text-sm font-black text-white transition hover:bg-[#12563c]"
              >
                Rehearse team entry →
              </a>
            </div>
          )}
        </div>
      ) : (
        <TeamEntryForm
          tournamentId={tournament.id}
          entryFee={tournament.entryFee}
          betaMode={isRocketBeta}
          playersByTier={Object.fromEntries(
            Object.entries(playersByTier).map(([tier, players]) => [
              tier,
              players.map((tp) => ({
                tournamentPlayerId: tp.id,
                playerId: tp.playerId,
                name: tp.player.name,
                country: tp.player.country,
                photoUrl: tp.player.photoUrl,
                dataGolfRank: tp.player.dataGolfRank,
                tier: tp.tier,
              })),
            ]),
          )}
          savedTeams={savedTeamsPreview}
        />
      )}
    </div>
  );
}
