import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminApiGuard } from "@/lib/admin-auth";

// ---------- POST: Add player to tournament ----------
export async function POST(req: NextRequest) {
  const denied = await adminApiGuard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { tournamentId, playerId, tier } = body as {
      tournamentId: string;
      playerId: string;
      tier?: string;
    };

    if (!tournamentId || !playerId) {
      return NextResponse.json(
        { error: "tournamentId and playerId required" },
        { status: 400 }
      );
    }

    const tp = await prisma.tournamentPlayer.create({
      data: {
        tournamentId,
        playerId,
        tier: tier ?? "T51_PLUS",
      },
    });

    return NextResponse.json({ success: true, id: tp.id });
  } catch (err) {
    console.error("Add tournament player error:", err);
    return NextResponse.json(
      { error: "Failed to add player" },
      { status: 500 }
    );
  }
}

// ---------- DELETE: Remove player from tournament ----------
export async function DELETE(req: NextRequest) {
  const denied = await adminApiGuard(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const tournamentPlayerId = searchParams.get("tournamentPlayerId");

    if (!tournamentPlayerId) {
      return NextResponse.json(
        { error: "tournamentPlayerId required" },
        { status: 400 }
      );
    }

    // Delete team selections referencing this player, then the TournamentPlayer
    await prisma.teamSelection.deleteMany({
      where: { tournamentPlayerId },
    });
    await prisma.tournamentPlayer.delete({
      where: { id: tournamentPlayerId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Remove tournament player error:", err);
    return NextResponse.json(
      { error: "Failed to remove player" },
      { status: 500 }
    );
  }
}
