import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { isTargetJudgeCoordinator } from "@/lib/target-judge-access";

export async function middleware(request: NextRequest) {
  const { response, verifiedEmail } = await updateSession(request);
  const pathname = request.nextUrl.pathname;
  const protectedApi =
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/sync") ||
    pathname === "/api/rocket-beta-control" ||
    pathname === "/api/test-db";
  const cronSafeApi =
    pathname === "/api/sync/results" ||
    pathname === "/api/sync/rankings" ||
    pathname === "/api/sync/schedule" ||
    pathname === "/api/sync/live" ||
    pathname === "/api/sync/rocket-field";
  const cronSecret = process.env.CRON_SECRET;
  const cronAuthorized = Boolean(
    cronSafeApi &&
      cronSecret &&
      cronSecret.length >= 32 &&
      request.headers.get("authorization") === `Bearer ${cronSecret}`,
  );
  const protectedPage =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/rocket-control";
  const disabledRocketSideGame =
    pathname === "/tournaments/rocket-classic/side-games" ||
    pathname.startsWith("/tournaments/rocket-classic/side-games/");

  if (disabledRocketSideGame) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (
    (protectedApi || protectedPage) &&
    !isTargetJudgeCoordinator(verifiedEmail) &&
    !cronAuthorized
  ) {
    if (protectedApi) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, manifest, icon files
     * - public assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
