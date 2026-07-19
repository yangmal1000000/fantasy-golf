import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import LeaguesClient from "./LeaguesClient";

export const dynamic = "force-dynamic";

export default async function LeaguesPage() {
  const user = await getCurrentUser();

  const memberships = user
    ? await prisma.leagueMember.findMany({
        where: { userId: user.id },
        include: {
          league: {
            include: {
              members: { include: { user: true } },
            },
          },
        },
        orderBy: { joinedAt: "desc" },
      })
    : [];

  const leagues = memberships.map((m) => ({
    id: m.league.id,
    name: m.league.name,
    description: m.league.description,
    inviteCode: m.league.inviteCode,
    createdAt: m.league.createdAt.toISOString(),
    memberCount: m.league.members.length,
    members: m.league.members.map((mem) => ({
      id: mem.userId,
      name: mem.user.name ?? mem.user.email,
      joinedAt: mem.joinedAt.toISOString(),
    })),
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#0a3d2a]">Leagues</h1>
        <p className="mt-1 text-zinc-600">
          Create private leagues and compete with your friends.
        </p>
      </div>

      <LeaguesClient leagues={leagues} signedIn={!!user} />
    </div>
  );
}
