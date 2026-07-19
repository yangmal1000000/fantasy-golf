import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { tournamentPlayerId, tier, madeCut, withdrew } = body as {
      tournamentPlayerId: string;
      tier?: string;
      madeCut?: boolean;
      withdrew?: boolean;
    };

    if (!tournamentPlayerId) {
      return NextResponse.json({ error: "tournamentPlayerId required" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (tier !== undefined) data.tier = tier;
    if (madeCut !== undefined) data.madeCut = madeCut;
    if (withdrew !== undefined) data.withdrew = withdrew;

    await prisma.tournamentPlayer.update({
      where: { id: tournamentPlayerId },
      data,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Player update error:", err);
    return NextResponse.json({ error: "Failed to update player" }, { status: 500 });
  }
}
