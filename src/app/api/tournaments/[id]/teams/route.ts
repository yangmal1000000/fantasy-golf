import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params;
    const body = await req.json();

    const { teamName, userId, selections } = body as {
      teamName: string;
      userId: string;
      selections: string[]; // tournamentPlayerIds
    };

    // Validate
    if (!teamName?.trim()) {
      return NextResponse.json({ error: "Team name required" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "User required" }, { status: 400 });
    }

    if (!selections || selections.length !== 5) {
      return NextResponse.json(
        { error: "Must select exactly 5 players (one per tier)" },
        { status: 400 }
      );
    }

    // Verify tournament exists and entries are open
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    if (tournament.status !== "entries_open" && tournament.status !== "upcoming") {
      return NextResponse.json({ error: "Entries are closed" }, { status: 400 });
    }

    // Verify each selection is from a different tier
    const tournamentPlayers = await prisma.tournamentPlayer.findMany({
      where: { id: { in: selections }, tournamentId },
    });

    if (tournamentPlayers.length !== 5) {
      return NextResponse.json(
        { error: "Invalid player selections" },
        { status: 400 }
      );
    }

    const tiers = new Set(tournamentPlayers.map((tp) => tp.tier));
    if (tiers.size !== 5) {
      return NextResponse.json(
        { error: "Must pick one player from each of the 5 tiers" },
        { status: 400 }
      );
    }

    // Create team + selections
    const team = await prisma.team.create({
      data: {
        name: teamName.trim(),
        userId,
        tournamentId,
        selections: {
          create: selections.map((tpId) => ({
            tournamentPlayerId: tpId,
          })),
        },
      },
      include: { selections: true },
    });

    // Increment selectionCount on each tournamentPlayer
    for (const tpId of selections) {
      await prisma.tournamentPlayer.update({
        where: { id: tpId },
        data: { selectionCount: { increment: 1 } },
      });
    }

    return NextResponse.json({ teamId: team.id, success: true });
  } catch (err) {
    console.error("Team creation error:", err);
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
    );
  }
}
