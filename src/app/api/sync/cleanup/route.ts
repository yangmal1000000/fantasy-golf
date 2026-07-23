import { NextResponse } from "next/server";
import { cleanupYearBranding } from "@/lib/data-sync";
import { adminApiGuard } from "@/lib/admin-auth";

export const maxDuration = 60;

/**
 * POST /api/sync/cleanup
 * Removes year suffixes from tournament names and IDs.
 * Merges old year-suffixed tournaments into clean-slug tournaments.
 */
export async function POST(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const result = await cleanupYearBranding();
    return NextResponse.json(result);
  } catch (e) {
    console.error("sync/cleanup error:", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}
