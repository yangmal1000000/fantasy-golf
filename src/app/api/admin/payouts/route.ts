import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tournamentId, payoutStructure } = body as {
      tournamentId: string;
      payoutStructure: Array<{ position: number; percentage: number }>;
    };

    if (!tournamentId || !payoutStructure) {
      return NextResponse.json(
        { error: "tournamentId and payoutStructure required" },
        { status: 400 }
      );
    }

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { payoutStructure: JSON.stringify(payoutStructure) },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Payout save error:", err);
    return NextResponse.json(
      { error: "Failed to save payout structure" },
      { status: 500 }
    );
  }
}
