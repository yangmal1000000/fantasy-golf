import { NextResponse } from "next/server";
import { cleanupYearBranding } from "@/lib/data-sync";

export const maxDuration = 60;

/**
 * POST /api/sync/cleanup
 * Removes year suffixes from tournament names and IDs.
 * Merges old year-suffixed tournaments into clean-slug tournaments.
 */
export async function POST() {
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
