import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import {
  canEdgeOperateAdmin,
  isAdminPortalUser,
  isEdgeAdminPathAllowed,
} from "@/lib/admin-access";

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
    pathname === "/rocket-control" ||
    pathname === "/target-control";
  const quarantinedLegacyAdminPage = [
    "/admin/auto-subs",
    "/admin/blog",
    "/admin/data",
    "/admin/revenue",
    "/admin/season",
    "/admin/settings",
    "/admin/tournaments",
  ].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const auditedPiiReveal =
    request.method === "POST" &&
    /^\/api\/admin\/customers\/[^/]+\/pii$/.test(pathname);
  const quarantinedLegacyMutation =
    pathname.startsWith("/api/admin/") &&
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    !auditedPiiReveal;
  const disabledRocketSideGame =
    pathname === "/tournaments/rocket-classic/side-games" ||
    pathname.startsWith("/tournaments/rocket-classic/side-games/");

  if (disabledRocketSideGame) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (quarantinedLegacyAdminPage) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (quarantinedLegacyMutation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    protectedPage &&
    !isEdgeAdminPathAllowed(verifiedEmail, pathname)
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (
    pathname === "/api/rocket-beta-control" &&
    request.method !== "GET" &&
    !canEdgeOperateAdmin(verifiedEmail)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    protectedApi &&
    !isAdminPortalUser(verifiedEmail) &&
    !cronAuthorized
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
