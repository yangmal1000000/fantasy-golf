import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

/**
 * Route-handler authorization guard for every admin/sync endpoint.
 * It intentionally returns a generic response so protected route existence and
 * database details are not exposed to unauthenticated callers.
 */
export async function adminApiGuard(
  request?: Request,
): Promise<NextResponse | null> {
  if (request && !sameOrigin(request)) {
    return NextResponse.json(
      { error: "Request origin rejected" },
      { status: 403 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }
  if (!user.isAdmin) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }

  return null;
}
