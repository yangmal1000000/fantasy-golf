import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { isTargetJudgeCoordinator } from "@/lib/target-judge-access";

export async function middleware(request: NextRequest) {
  const { response, verifiedEmail } = await updateSession(request);
  const pathname = request.nextUrl.pathname;
  const protectedApi =
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/sync") ||
    pathname === "/api/test-db";
  const protectedPage = pathname === "/admin" || pathname.startsWith("/admin/");

  if ((protectedApi || protectedPage) && !isTargetJudgeCoordinator(verifiedEmail)) {
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
