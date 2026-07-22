import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { formatDateRange } from "@/lib/ui";
import TeamEntryForm from "./TeamEntryForm";

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
          title="Sign in to Enter"
          message="Create your fantasy golf team by signing in with Google."
        />
      </div>
    );
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
      ) : (
        <TeamEntryForm
          tournamentId={tournament.id}
          entryFee={tournament.entryFee}
          userId={user.id}
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
