import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { inviteCode } = body as { inviteCode: string };

    if (!inviteCode?.trim()) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const league = await prisma.league.findUnique({
      where: { inviteCode: inviteCode.trim() },
    });

    if (!league) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Sign in required" },
        { status: 401 },
      );
    }

    // Check if already a member
    const existing = await prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: { leagueId: league.id, userId: user.id },
      },
    });

    if (existing) {
      return NextResponse.json({
        leagueId: league.id,
        alreadyMember: true,
        success: true,
      });
    }

    await prisma.leagueMember.create({
      data: { leagueId: league.id, userId: user.id },
    });

    return NextResponse.json({ leagueId: league.id, success: true });
  } catch (err) {
    console.error("League join error:", err);
    return NextResponse.json({ error: "Failed to join league" }, { status: 500 });
  }
}
