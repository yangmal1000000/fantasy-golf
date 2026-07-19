import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import LeaguesClient from "./LeaguesClient";
import SignInPrompt from "@/components/SignInPrompt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leagues — Fantasy Golf",
  description: "Create or join private fantasy golf leagues. Compete with friends and colleagues in your own mini-competitions.",
};

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
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-[#0a3d2a] dark:text-green-400 sm:text-2xl">Leagues</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Create private leagues and compete with friends</p>
      </div>

      {!user ? (
        <SignInPrompt
          title="Sign in to join or create a league"
          message="Create private leagues with friends, share invite codes, and run your own mini-competitions throughout the season."
        />
      ) : (
        <LeaguesClient leagues={leagues} signedIn={!!user} />
      )}
    </div>
  );
}
