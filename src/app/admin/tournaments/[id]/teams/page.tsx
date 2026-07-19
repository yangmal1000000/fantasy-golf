import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import TeamsManager from "./TeamsManager";

export const dynamic = "force-dynamic";

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({ where: { id } });

  if (!tournament) notFound();

  const teams = await prisma.team.findMany({
    where: { tournamentId: id },
    include: {
      user: true,
      selections: {
        include: {
          tournamentPlayer: { include: { player: true } },
        },
      },
    },
    orderBy: [{ position: "asc" }, { totalScore: "asc" }],
  });

  const serialized = teams.map((t) => ({
    id: t.id,
    name: t.name,
    paid: t.paid,
    totalScore: t.totalScore,
    position: t.position,
    createdAt: t.createdAt.toISOString(),
    user: {
      name: t.user?.name ?? null,
      email: t.user?.email,
    },
    selections: t.selections.map((s) => ({
      playerName: s.tournamentPlayer.player.name,
      tier: s.tournamentPlayer.tier,
    })),
  }));

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <nav className="mb-2 text-sm text-zinc-500">
          <a href="/admin/tournaments" className="hover:underline">Tournaments</a>
          {" / "}
          <span className="text-zinc-700">{tournament.name}</span>
        </nav>
        <h1 className="text-2xl font-bold text-zinc-900">
          Teams — {tournament.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {teams.length} team{teams.length !== 1 ? "s" : ""} entered
        </p>
      </div>
      <TeamsManager
        tournamentId={id}
        entryFee={tournament.entryFee}
        teams={serialized}
      />
    </div>
  );
}
