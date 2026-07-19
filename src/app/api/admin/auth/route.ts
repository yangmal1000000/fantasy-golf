import { NextRequest, NextResponse } from "next/server";

/**
 * Simple admin auth: sets a cookie so the admin layout can gate access.
 * Usage: GET /api/admin/auth → sets cookie, redirects to /admin
 */
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/admin", req.url));
  res.cookies.set("admin_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}

/** Check auth status */
export async function HEAD() {
  return NextResponse.json({ ok: true });
}
