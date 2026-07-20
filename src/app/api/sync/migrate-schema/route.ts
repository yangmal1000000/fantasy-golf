import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

/**
 * POST /api/sync/migrate-schema
 * Adds new columns to the Tournament table that were added to the Prisma schema
 * but couldn't be pushed via prisma db push (local connection issues).
 */
export async function POST() {
  try {
    // Raw SQL to add columns if they don't exist
    await prisma.$executeRawUnsafe(`ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "yardage" INTEGER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "architect" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "courseLocation" TEXT`);

    return NextResponse.json({ ok: true, message: "Migration complete" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}
