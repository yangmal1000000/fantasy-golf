import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { tierForRank } from "@/lib/tournament-templates";

export const dynamic = "force-dynamic";

// DELETE — remove a saved team template
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership before deleting
    const savedTeam = await prisma.savedTeam.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!savedTeam) {
      return NextResponse.json({ error: "Saved team not found" }, { status: 404 });
    }

    if (savedTeam.userId !== user.id) {
      return NextResponse.json({ error: "Not authorised to delete this team" }, { status: 403 });
    }

    // Cascade delete handles SavedTeamPlayer rows
    await prisma.savedTeam.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Saved team DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete saved team" }, { status: 500 });
  }
}

// PUT — update a saved team template (rename and/or swap players)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const savedTeam = await prisma.savedTeam.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!savedTeam) {
      return NextResponse.json({ error: "Saved team not found" }, { status: 404 });
    }

    if (savedTeam.userId !== user.id) {
      return NextResponse.json({ error: "Not authorised to edit this team" }, { status: 403 });
    }

    const body = await req.json();
    const { name, players } = body as {
      name?: string;
      players?: { playerId: string; tier: string }[];
    };

    // Update name if provided
    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Team name cannot be empty" }, { status: 400 });
      }
      if (trimmed.length > 50) {
        return NextResponse.json({ error: "Team name must be 50 characters or fewer" }, { status: 400 });
      }
    }

    // Validate players if provided
    if (players !== undefined) {
      if (!Array.isArray(players) || players.length === 0) {
        return NextResponse.json({ error: "At least one player is required" }, { status: 400 });
      }

      // Check tier uniqueness
      const tiers = players.map((p) => p.tier);
      const uniqueTiers = new Set(tiers);
      if (tiers.length !== uniqueTiers.size) {
        return NextResponse.json(
          { error: "Duplicate tiers detected. Each player must be in a different tier." },
          { status: 400 },
        );
      }

      // Validate player IDs exist
      const playerIds = players.map((p) => p.playerId);
      const dbPlayers = await prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, dataGolfRank: true },
      });
      const validPlayerIds = new Set(dbPlayers.map((p) => p.id));
      const invalidPlayers = playerIds.filter((pid) => !validPlayerIds.has(pid));
      if (invalidPlayers.length > 0) {
        return NextResponse.json(
          { error: `Invalid player IDs: ${invalidPlayers.join(", ")}` },
          { status: 400 },
        );
      }

      // Verify tier assignments match player ranks
      const playerRankMap = new Map(dbPlayers.map((p) => [p.id, p.dataGolfRank]));
      for (const slot of players) {
        const rank = playerRankMap.get(slot.playerId);
        const expectedTier = tierForRank(rank);
        if (slot.tier !== expectedTier) {
          return NextResponse.json(
            { error: `Player is in ${expectedTier}, not ${slot.tier}. Refresh and try again.` },
            { status: 400 },
          );
        }
      }
    }

    // Perform update in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update name
      if (name !== undefined) {
        await tx.savedTeam.update({
          where: { id },
          data: { name: name.trim() },
        });
      }

      // Replace players if provided
      if (players !== undefined) {
        // Delete existing slots
        await tx.savedTeamPlayer.deleteMany({ where: { savedTeamId: id } });

        // Create new slots
        await tx.savedTeamPlayer.createMany({
          data: players.map((p) => ({
            savedTeamId: id,
            playerId: p.playerId,
            tier: p.tier,
          })),
        });
      }

      return tx.savedTeam.findUnique({
        where: { id },
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
      });
    });

    return NextResponse.json({ savedTeam: updated, success: true });
  } catch (err) {
    console.error("Saved team PUT error:", err);
    return NextResponse.json({ error: "Failed to update saved team" }, { status: 500 });
  }
}
