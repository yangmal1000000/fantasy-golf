import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminApiGuard } from "@/lib/admin-auth";

// ---------- POST: Send broadcast message ----------
export async function POST(req: NextRequest) {
  const denied = await adminApiGuard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { tournamentId, subject, body: messageBody } = body as {
      tournamentId: string;
      subject: string;
      body: string;
    };

    if (!tournamentId || !subject || !messageBody) {
      return NextResponse.json(
        { error: "tournamentId, subject, and body are required" },
        { status: 400 }
      );
    }

    // Save broadcast message
    const message = await prisma.broadcastMessage.create({
      data: { tournamentId, subject, body: messageBody },
    });

    // Get all entrants (users who have teams in this tournament)
    const teams = await prisma.team.findMany({
      where: { tournamentId },
      select: { userId: true },
      distinct: ["userId"],
    });

    // Create notification for each user
    if (teams.length > 0) {
      await prisma.notification.createMany({
        data: teams.map((t) => ({
          userId: t.userId,
          title: subject,
          body: messageBody,
          type: "info",
        })),
      });
    }

    return NextResponse.json({
      success: true,
      messageId: message.id,
      recipients: teams.length,
    });
  } catch (err) {
    console.error("Broadcast message error:", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

// ---------- GET: List messages for a tournament ----------
export async function GET(req: NextRequest) {
  const denied = await adminApiGuard(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get("tournamentId");

    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId required" },
        { status: 400 }
      );
    }

    const messages = await prisma.broadcastMessage.findMany({
      where: { tournamentId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ messages });
  } catch (err) {
    console.error("Fetch messages error:", err);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
