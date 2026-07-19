import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { calculateTeamScore } from "@/lib/scoring";
import { formatDateRange } from "@/lib/ui";
import LeagueChat from "@/components/LeagueChat";

export const dynamic = "force-dynamic";

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;

  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: true },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!league) notFound();

  // Check membership
  const isMember = user ? league.members.some((m) => m.userId === user.id) : false;
  if (!isMember) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-6 text-center">
          <p className="text-lg font-semibold text-red-700">Not a member</p>
          <p className="mt-1 text-sm text-red-600">You are not in this league.</p>
          <Link href="/leagues" className="mt-4 inline-block text-sm font-bold text-[#0a3d2a] hover:underline">
            ← Back to Leagues
          </Link>
        </div>
      </div>
    );
  }

  // Get all tournaments that have teams from league members
  const memberUserIds = league.members.map((m) => m.userId);

  const teams = await prisma.team.findMany({
    where: { userId: { in: memberUserIds } },
    include: {
      tournament: true,
      user: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Group teams by tournament
  const teamsByTournament: Record<string, {
    tournament: typeof teams[0]["tournament"];
    teams: typeof teams;
  }> = {};

  for (const team of teams) {
    const tId = team.tournamentId;
    if (!teamsByTournament[tId]) {
      teamsByTournament[tId] = {
        tournament: team.tournament,
        teams: [],
      };
    }
    teamsByTournament[tId].teams.push(team);
  }

  // Calculate scores for each team in each tournament (for mini-leaderboards)
  const tournamentLeaderboards: Record<string, {
    tournament: typeof teams[0]["tournament"];
    results: Awaited<ReturnType<typeof calculateTeamScore>>[];
  }> = {};

  for (const [tId, data] of Object.entries(teamsByTournament)) {
    const results: Awaited<ReturnType<typeof calculateTeamScore>>[] = [];
    for (const team of data.teams) {
      try {
        const score = await calculateTeamScore(team.id);
        results.push(score);
      } catch {
        // skip
      }
    }
    results.sort((a, b) => a.totalStrokes - b.totalStrokes);
    // Assign positions
    let pos = 1;
    for (let i = 0; i < results.length; i++) {
      if (i > 0 && results[i].totalStrokes === results[i - 1].totalStrokes) {
        results[i].position = results[i - 1].position;
      } else {
        results[i].position = pos;
      }
      pos = i + 1;
    }
    tournamentLeaderboards[tId] = { tournament: data.tournament, results };
  }

  // Sort tournaments by start date desc
  const sortedTournamentIds = Object.entries(tournamentLeaderboards)
    .sort(([, a], [, b]) => b.tournament.startDate.getTime() - a.tournament.startDate.getTime())
    .map(([id]) => id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <div className="mb-4">
        <Link href="/leagues" className="text-sm text-zinc-500 hover:text-[#0a3d2a]">
          ← Leagues
        </Link>
      </div>

      {/* League header */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#0a3d2a] to-[#0a3d2a] p-6 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{league.name}</h1>
            {league.description && (
              <p className="mt-1 text-sm text-white/70">{league.description}</p>
            )}
            <p className="mt-2 text-xs text-white/50">
              Created {new Date(league.createdAt).toLocaleDateString("en-GB")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50">Members</p>
            <p className="text-3xl font-extrabold text-[#c8a951]">
              {league.members.length}
            </p>
          </div>
        </div>
        {/* Invite code */}
        <div className="mt-4 flex items-center gap-2 border-t border-white/20 pt-3">
          <span className="text-xs text-white/50">Invite Code:</span>
          <code className="rounded-lg bg-white/10 px-3 py-1 font-mono text-sm font-bold text-[#c8a951]">
            {league.inviteCode}
          </code>
          <span className="text-xs text-white/40">Share to invite friends</span>
        </div>
      </div>

      {/* Members */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-[#0a3d2a]">Members</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {league.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0a3d2a] text-xs font-bold text-white">
                {(m.user.name ?? m.user.email ?? "?")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-800">
                  {m.user.name ?? m.user.email}
                  {user && m.userId === user.id && (
                    <span className="ml-1 text-xs font-normal text-[#0a3d2a]">(you)</span>
                  )}
                </p>
                <p className="text-xs text-zinc-400">
                  Joined {new Date(m.joinedAt).toLocaleDateString("en-GB")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mini Leaderboards */}
      <div className="mt-6">
        <h2 className="mb-4 text-lg font-bold text-[#0a3d2a]">League Standings</h2>

        {sortedTournamentIds.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
            <p className="text-sm text-zinc-500">
              No tournament entries from league members yet.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedTournamentIds.map((tId) => {
              const { tournament, results } = tournamentLeaderboards[tId];
              return (
                <div key={tId} className="rounded-2xl bg-white shadow-sm">
                  {/* Tournament header */}
                  <div className="border-b border-zinc-100 p-4">
                    <Link
                      href={`/tournaments/${tId}/leaderboard`}
                      className="font-bold text-[#0a3d2a] hover:underline"
                    >
                      {tournament.name}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      📍 {tournament.course ?? "TBD"} · {formatDateRange(tournament.startDate, tournament.endDate)}
                    </p>
                  </div>

                  {/* Mini leaderboard */}
                  {results.length === 0 ? (
                    <p className="p-4 text-sm text-zinc-400">No scored entries yet.</p>
                  ) : (
                    <div className="divide-y divide-zinc-50">
                      {results.map((r) => {
                        const totalPar = tournament.par * 4 * 5;
                        const vsPar = r.totalStrokes - totalPar;
                        return (
                          <Link
                            key={r.teamId}
                            href={`/tournaments/${tId}/teams/${r.teamId}`}
                            className="flex items-center gap-3 p-3 transition hover:bg-zinc-50"
                          >
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              r.position === 1
                                ? "bg-[#c8a951] text-[#1a1a1a]"
                                : "bg-zinc-100 text-zinc-600"
                            }`}>
                              {r.position}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-zinc-800">{r.teamName}</p>
                              <p className="truncate text-xs text-zinc-500">{r.ownerName}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-[#0a3d2a]">{r.totalStrokes}</p>
                              <p className={`text-xs ${vsPar < 0 ? "text-red-500" : "text-zinc-400"}`}>
                                {vsPar > 0 ? "+" : ""}{vsPar === 0 ? "E" : vsPar}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* League Chat */}
      <LeagueChat leagueId={league.id} leagueName={league.name} currentUserId={userId} />
    </div>
  );
}
