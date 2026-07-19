import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/push/vapid-key
 * Returns the public VAPID key for client-side push subscription.
 * Returns 404 if push is not configured.
 */
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json({ configured: false }, { status: 404 });
  }
  return NextResponse.json({ configured: true, publicKey: key });
}
