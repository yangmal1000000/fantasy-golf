import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in required" },
        { status: 401 }
      );
    }
    const userId = user.id;

    const body = await request.json();
    const { tournamentId, type, playerId, roundNumber } = body;

    // Validate required fields
    if (!tournamentId || !type) {
      return NextResponse.json(
        { error: "Missing required fields: tournamentId, type" },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ["top_golfer", "best_round", "dark_horse"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Check tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      );
    }

    // Type-specific validation
    if (type === "top_golfer") {
      if (!playerId) {
        return NextResponse.json(
          { error: "top_golfer requires a playerId" },
          { status: 400 }
        );
      }

      // Check player is in tournament
      const tp = await prisma.tournamentPlayer.findUnique({
        where: {
          tournamentId_playerId: { tournamentId, playerId },
        },
      });
      if (!tp) {
        return NextResponse.json(
          { error: "Player not in this tournament" },
          { status: 400 }
        );
      }

      // Check no existing entry
      const existing = await prisma.sideBet.findFirst({
        where: { tournamentId, userId, type },
      });
      if (existing) {
        return NextResponse.json(
          { error: "You already have a top_golfer entry for this tournament" },
          { status: 409 }
        );
      }
    }

    if (type === "dark_horse") {
      if (!playerId) {
        return NextResponse.json(
          { error: "dark_horse requires a playerId" },
          { status: 400 }
        );
      }

      // Check player is T5
      const tp = await prisma.tournamentPlayer.findUnique({
        where: {
          tournamentId_playerId: { tournamentId, playerId },
        },
      });
      if (!tp) {
        return NextResponse.json(
          { error: "Player not in this tournament" },
          { status: 400 }
        );
      }
      if (tp.tier !== "T51_PLUS") {
        return NextResponse.json(
          { error: "Dark horse pick must be a Tier 5 golfer (rank 51+)" },
          { status: 400 }
        );
      }

      // Check no existing entry
      const existing = await prisma.sideBet.findFirst({
        where: { tournamentId, userId, type },
      });
      if (existing) {
        return NextResponse.json(
          { error: "You already have a dark_horse entry for this tournament" },
          { status: 409 }
        );
      }
    }

    if (type === "best_round") {
      // Check no existing entry for the same round
      const existing = await prisma.sideBet.findFirst({
        where: { tournamentId, userId, type, roundNumber },
      });
      if (existing) {
        return NextResponse.json(
          { error: "You already have a best_round entry for this round" },
          { status: 409 }
        );
      }
    }

    // Create the side bet
    const sideBet = await prisma.sideBet.create({
      data: {
        tournamentId,
        userId,
        type,
        playerId: playerId ?? null,
        roundNumber: roundNumber ?? null,
        paid: true,
      },
    });

    return NextResponse.json({ success: true, sideBet }, { status: 201 });
  } catch (error) {
    console.error("[side-games/enter] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
