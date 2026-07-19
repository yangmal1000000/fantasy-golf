import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description } = body as { name: string; description?: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: "League name is required" }, { status: 400 });
    }

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Sign in required" },
        { status: 401 },
      );
    }

    const league = await prisma.league.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        members: {
          create: { userId: user.id },
        },
      },
    });

    return NextResponse.json({ leagueId: league.id, inviteCode: league.inviteCode, success: true });
  } catch (err) {
    console.error("League creation error:", err);
    return NextResponse.json({ error: "Failed to create league" }, { status: 500 });
  }
}
