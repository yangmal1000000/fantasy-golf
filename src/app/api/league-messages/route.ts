import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureSchema, genId } from "@/lib/db-ensure";
import { cleanProfanity } from "@/lib/profanity";

export const dynamic = "force-dynamic";

interface LeagueMessageRow {
  id: string;
  body: string;
  createdAt: Date;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
}

// GET — messages for a league (members only)
export async function GET(req: NextRequest) {
  const leagueId = req.nextUrl.searchParams.get("leagueId");
  if (!leagueId) {
    return NextResponse.json({ error: "leagueId required" }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  await ensureSchema();

  // Verify the league exists and user is a member
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { members: { select: { userId: true } } },
  });
  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }
  if (!league.members.some((m) => m.userId === user.id)) {
    return NextResponse.json({ error: "Not a league member" }, { status: 403 });
  }

  const rows: LeagueMessageRow[] = await prisma.$queryRawUnsafe(
    `SELECT m.id, m.body, m."createdAt", m."userId", u.name AS "userName", u.avatar AS "userAvatar"
       FROM "Message" m
       JOIN "User" u ON u.id = m."userId"
       WHERE m."leagueId" = $1
       ORDER BY m."createdAt" ASC
       LIMIT 200`,
    leagueId,
  );

  return NextResponse.json({
    messages: rows.map((r) => ({
      id: r.id,
      body: r.body,
      userId: r.userId,
      userName: r.userName ?? "Anonymous",
      userAvatar: r.userAvatar ?? null,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
  });
}

// POST — send a message
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    const { leagueId, text } = body as { leagueId?: string; text?: string };
    if (!leagueId || typeof text !== "string") {
      return NextResponse.json({ error: "leagueId and text required" }, { status: 400 });
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }
    if (trimmed.length > 500) {
      return NextResponse.json({ error: "Message too long (500 chars max)" }, { status: 400 });
    }

    await ensureSchema();

    // Verify league + membership
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: { members: { select: { userId: true } } },
    });
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }
    if (!league.members.some((m) => m.userId === user.id)) {
      return NextResponse.json({ error: "Not a league member" }, { status: 403 });
    }

    // Reject pure-profanity messages but allow cleaned text
    const cleaned = cleanProfanity(trimmed);

    const id = genId();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Message" (id, "leagueId", "userId", body)
       VALUES ($1, $2, $3, $4)`,
      id,
      leagueId,
      user.id,
      cleaned,
    );

    // Notify all other league members
    const otherMembers = league.members.filter((m) => m.userId !== user.id);
    if (otherMembers.length > 0) {
      const notifs = otherMembers.map((m) => ({
        id: genId(),
        userId: m.userId,
        title: `💬 New message in ${league.name}`,
        body: `${user.name ?? "Someone"}: ${cleaned.slice(0, 80)}`,
        type: "league_message",
        read: false,
        createdAt: new Date(),
      }));
      try {
        // Use Prisma's createMany for notifications (typed model in schema)
        await prisma.notification.createMany({ data: notifs });
      } catch {
        // ignore notif failure
      }
    }

    return NextResponse.json({
      message: {
        id,
        body: cleaned,
        userId: user.id,
        userName: user.name ?? "Anonymous",
        userAvatar: user.avatar ?? null,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("league-messages POST error:", err);
    return NextResponse.json({ error: "Failed to post message" }, { status: 500 });
  }
}
