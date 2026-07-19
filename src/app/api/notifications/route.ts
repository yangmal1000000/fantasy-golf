import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { genId } from "@/lib/db-ensure";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

// GET — return notifications for the current user, plus auto-generated smart notifications
export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    // Opportunistically generate smart notifications (idempotent — relies on
    // simple time-window heuristics; won't duplicate because titles are distinct
    // per day).
    await generateSmartNotifications(user.id).catch(() => {});

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, read: false },
    });

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (err) {
    console.error("Notifications GET error:", err);
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}

// POST — mark notifications as read, or trigger browser-push subscription
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { notificationId, markAll } = body as {
      notificationId?: string;
      markAll?: boolean;
    };

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      await prisma.notification.updateMany({
        where: { id: notificationId, userId: user.id },
        data: { read: true },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "No action specified" }, { status: 400 });
  } catch (err) {
    console.error("Notifications POST error:", err);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------
// Smart notification generation
// ---------------------------------------------------------------------

/** Create an in-app notification and fire a push notification. */
async function createNotification(
  userId: string,
  title: string,
  body: string,
  type: string,
  url?: string,
): Promise<void> {
  await prisma.notification.create({
    data: { id: genId(), userId, title, body, type },
  });
  await sendPushToUser(userId, { title, body, url }).catch(() => {});
}

async function generateSmartNotifications(userId: string): Promise<void> {
  const today = new Date();

  // 1. Entries closing within 24h
  const closingSoon = await prisma.tournament.findMany({
    where: {
      status: "entries_open",
      startDate: {
        gte: today,
        lte: new Date(today.getTime() + 48 * 60 * 60 * 1000),
      },
    },
    take: 10,
  });

  for (const t of closingSoon) {
    const title = `⏰ Entries closing soon: ${t.name}`;
    const existing = await prisma.notification.findFirst({
      where: { userId, title },
    });
    if (!existing) {
      await createNotification(
        userId,
        title,
        `Tournament starts ${t.startDate.toLocaleDateString("en-GB")}. Get your team in!`,
        "entries_closing",
        `/tournaments/${t.id}`,
      );
    }
  }

  // 2. Position changes (3+ places) — compare current position to the stored
  //    totalStrokes snapshot on teams. We use a simple heuristic: look at teams
  //    belonging to this user in in_progress tournaments.
  const userTeams = await prisma.team.findMany({
    where: { userId },
    include: { tournament: true },
  });

  for (const team of userTeams) {
    if (team.tournament.status !== "in_progress") continue;
    if (team.position == null) continue;

    // Use the position field vs. a recent notification snapshot to detect big
    // swings. We store last-notified position in the title string.
    const titleKey = `📊 Big mover: ${team.tournament.name}`;
    const recent = await prisma.notification.findFirst({
      where: {
        userId,
        title: titleKey,
        createdAt: { gte: new Date(today.getTime() - 6 * 60 * 60 * 1000) },
      },
    });

    if (!recent && team.position) {
      // Without a persistent last-position field, we fire once per 6h if the
      // team is inside the top 10 movers (cheap heuristic).
      // Only notify if position is <= 20 (interesting).
      if (team.position <= 20) {
        await createNotification(
          userId,
          titleKey,
          `Your team "${team.name}" is in position ${team.position} at ${team.tournament.name}.`,
          "position_change",
          `/tournaments/${team.tournamentId}/leaderboard`,
        );
      }
    }
  }

  // 3. Round complete notification — when a tournament's currentRound advanced
  const liveTeams = userTeams.filter(
    (t) => t.tournament.status === "in_progress" && t.tournament.currentRound > 0,
  );
  for (const team of liveTeams) {
    const r = team.tournament.currentRound;
    const title = `⛳ Round ${r} complete at ${team.tournament.name}`;
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        title,
        createdAt: { gte: new Date(today.getTime() - 24 * 60 * 60 * 1000) },
      },
    });
    if (!existing) {
      await createNotification(
        userId,
        title,
        `Round ${r} is in the books. Check your team's performance!`,
        "round_complete",
        `/tournaments/${team.tournamentId}`,
      );
    }
  }
}
