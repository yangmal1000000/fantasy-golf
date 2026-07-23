import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminApiGuard } from "@/lib/admin-auth";

// ---------- POST: Create tournament ----------
export async function POST(req: NextRequest) {
  const denied = await adminApiGuard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { name, course, startDate, endDate, par, entryFee } = body as {
      name: string;
      course?: string;
      startDate: string;
      endDate: string;
      par?: number;
      entryFee?: number;
    };

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: "name, startDate, and endDate are required" },
        { status: 400 }
      );
    }

    const tournament = await prisma.tournament.create({
      data: {
        name,
        course: course || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        par: par ?? 72,
        entryFee: entryFee ?? 1500,
        status: "upcoming",
      },
    });

    return NextResponse.json({ success: true, id: tournament.id });
  } catch (err) {
    console.error("Tournament create error:", err);
    return NextResponse.json(
      { error: "Failed to create tournament" },
      { status: 500 }
    );
  }
}

// ---------- PATCH: Update tournament ----------
export async function PATCH(req: NextRequest) {
  const denied = await adminApiGuard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const {
      tournamentId,
      name,
      course,
      status,
      currentRound,
      cutLine,
      par,
      entryFee,
      prizePool,
      payoutStructure,
      startDate,
      endDate,
    } = body as {
      tournamentId: string;
      name?: string;
      course?: string;
      status?: string;
      currentRound?: number;
      cutLine?: number | null;
      par?: number;
      entryFee?: number;
      prizePool?: number;
      payoutStructure?: string;
      startDate?: string;
      endDate?: string;
    };

    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId required" },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (course !== undefined) data.course = course;
    if (status !== undefined) data.status = status;
    if (currentRound !== undefined) data.currentRound = currentRound;
    if (cutLine !== undefined) data.cutLine = cutLine;
    if (par !== undefined) data.par = par;
    if (entryFee !== undefined) data.entryFee = entryFee;
    if (prizePool !== undefined) data.prizePool = prizePool;
    if (payoutStructure !== undefined) data.payoutStructure = payoutStructure;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);

    await prisma.tournament.update({
      where: { id: tournamentId },
      data,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Tournament update error:", err);
    return NextResponse.json(
      { error: "Failed to update tournament" },
      { status: 500 }
    );
  }
}

// ---------- DELETE: Delete tournament ----------
export async function DELETE(req: NextRequest) {
  const denied = await adminApiGuard(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get("tournamentId");

    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId query param required" },
        { status: 400 }
      );
    }

    // Delete in dependency order
    await prisma.score.deleteMany({ where: { tournamentId } });
    await prisma.teamSelection.deleteMany({
      where: { team: { tournamentId } },
    });
    await prisma.team.deleteMany({ where: { tournamentId } });
    await prisma.tournamentPlayer.deleteMany({ where: { tournamentId } });
    await prisma.broadcastMessage.deleteMany({ where: { tournamentId } });
    await prisma.tournament.delete({ where: { id: tournamentId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Tournament delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete tournament" },
      { status: 500 }
    );
  }
}
