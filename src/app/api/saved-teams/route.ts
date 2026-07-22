import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — list the current user's saved team templates
export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const savedTeams = await prisma.savedTeam.findMany({
      where: { userId: user.id },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                country: true,
                photoUrl: true,
                dataGolfRank: true,
                wtRank: true,
              },
            },
          },
          orderBy: { tier: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ savedTeams });
  } catch (err) {
    console.error("Saved teams GET error:", err);
    return NextResponse.json({ error: "Failed to fetch saved teams" }, { status: 500 });
  }
}

// POST — create a new saved team template
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    const { name, players } = body as {
      name?: string;
      players: { playerId: string; tier: string }[];
    };

    if (!players || !Array.isArray(players) || players.length === 0) {
      return NextResponse.json({ error: "At least one player is required" }, { status: 400 });
    }

    // Enforce max 5 saved teams per user
    const existingCount = await prisma.savedTeam.count({ where: { userId: user.id } });
    if (existingCount >= 5) {
      return NextResponse.json(
        { error: "Maximum of 5 saved teams reached. Delete one before adding another." },
        { status: 400 },
      );
    }

    // Validate tier uniqueness (one player per tier)
    const tiers = players.map((p) => p.tier);
    const uniqueTiers = new Set(tiers);
    if (tiers.length !== uniqueTiers.size) {
      return NextResponse.json(
        { error: "Duplicate tiers detected. Each player must be in a different tier." },
        { status: 400 },
      );
    }

    // Validate that all player IDs exist
    const playerIds = players.map((p) => p.playerId);
    const dbPlayers = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      select: { id: true },
    });
    const validPlayerIds = new Set(dbPlayers.map((p) => p.id));
    const invalidPlayers = playerIds.filter((id) => !validPlayerIds.has(id));
    if (invalidPlayers.length > 0) {
      return NextResponse.json(
        { error: `Invalid player IDs: ${invalidPlayers.join(", ")}` },
        { status: 400 },
      );
    }

    const savedTeam = await prisma.savedTeam.create({
      data: {
        userId: user.id,
        name: name?.trim() || `Team ${existingCount + 1}`,
        players: {
          create: players.map((p) => ({
            playerId: p.playerId,
            tier: p.tier,
          })),
        },
      },
      include: {
        players: { include: { player: true } },
      },
    });

    return NextResponse.json({ savedTeam, success: true });
  } catch (err) {
    console.error("Saved team POST error:", err);
    return NextResponse.json({ error: "Failed to create saved team" }, { status: 500 });
  }
}
