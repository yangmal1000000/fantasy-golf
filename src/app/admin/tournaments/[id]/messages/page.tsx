import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import MessageCenter from "./MessageCenter";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [tournament, messages, teams] = await Promise.all([
    prisma.tournament.findUnique({ where: { id } }),
    prisma.broadcastMessage.findMany({
      where: { tournamentId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.team.findMany({
      where: { tournamentId: id },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  if (!tournament) notFound();

  const recipientCount = teams.length;

  const serializedMessages = messages.map((m) => ({
    id: m.id,
    subject: m.subject,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
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
          Messages — {tournament.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Send notifications to all entrants ({recipientCount} recipients)
        </p>
      </div>
      <MessageCenter
        tournamentId={id}
        tournamentName={tournament.name}
        messages={serializedMessages}
        recipientCount={recipientCount}
      />
    </div>
  );
}
