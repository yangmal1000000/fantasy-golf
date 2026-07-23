import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminApiGuard } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const denied = await adminApiGuard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { tournamentId, scores } = body as {
      tournamentId: string;
      scores: Array<{ playerId: string; round: number; strokes: number }>;
    };

    if (!tournamentId || !scores || !Array.isArray(scores)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    let created = 0;
    let updated = 0;

    for (const entry of scores) {
      const existing = await prisma.score.findUnique({
        where: {
          tournamentId_playerId_round: {
            tournamentId,
            playerId: entry.playerId,
            round: entry.round,
          },
        },
      });

      if (existing) {
        await prisma.score.update({
          where: { id: existing.id },
          data: { strokes: entry.strokes, isEstimated: false },
        });
        updated++;
      } else {
        await prisma.score.create({
          data: {
            tournamentId,
            playerId: entry.playerId,
            round: entry.round,
            strokes: entry.strokes,
            isEstimated: false,
          },
        });
        created++;
      }
    }

    return NextResponse.json({ success: true, created, updated });
  } catch (err) {
    console.error("Score save error:", err);
    return NextResponse.json({ error: "Failed to save scores" }, { status: 500 });
  }
}
