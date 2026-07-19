import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureSchema, genId } from "@/lib/db-ensure";

export const dynamic = "force-dynamic";

/**
 * POST /api/push/subscribe
 * Body: { endpoint, keys: { p256dh, auth } }
 * Stores the push subscription for the current user.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    const { endpoint, keys } = body as {
      endpoint: string;
      keys?: { p256dh?: string; auth?: string };
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "Missing endpoint or keys" },
        { status: 400 },
      );
    }

    await ensureSchema();

    await prisma.$executeRawUnsafe(
      `INSERT INTO "PushSubscription" (id, "userId", endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ("userId", endpoint) DO NOTHING`,
      genId(),
      user.id,
      endpoint,
      keys.p256dh,
      keys.auth,
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Push subscribe error:", err);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 },
    );
  }
}
