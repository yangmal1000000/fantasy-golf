import { NextResponse } from "next/server";
import { fixVenues } from "@/lib/data-sync";
import { adminApiGuard } from "@/lib/admin-auth";

export const maxDuration = 60;

/**
 * POST /api/sync/fix-venues
 * Backfills missing course names, yardage, architect, and course location
 * for tournaments that have null/TBD course data, using a static course map.
 */
export async function POST(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const result = await fixVenues();
    return NextResponse.json(result);
  } catch (e) {
    console.error("sync/fix-venues error:", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}
