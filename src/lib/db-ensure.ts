import { prisma } from "@/lib/prisma";

/**
 * Ensures engagement-feature tables exist via idempotent CREATE TABLE IF NOT EXISTS.
 * Called lazily by API routes because Prisma migrations are not run from local.
 * Column names use quoted camelCase to match Prisma conventions.
 *
 * Prisma client types are NOT regenerated; callers must use prisma.$queryRawUnsafe
 * and cast to `any`.
 */

let ensured = false;
let ensuring: Promise<void> | null = null;

const DDL = [
  // --- League chat messages ---
  `CREATE TABLE IF NOT EXISTS "Message" (
     id TEXT PRIMARY KEY,
     "leagueId" TEXT NOT NULL REFERENCES "League"(id) ON DELETE CASCADE,
     "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
     body TEXT NOT NULL,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "idx_message_league" ON "Message"("leagueId")`,
  `CREATE INDEX IF NOT EXISTS "idx_message_created" ON "Message"("createdAt")`,

  // --- Daily prediction mini-game ---
  `CREATE TABLE IF NOT EXISTS "DailyPrediction" (
     id TEXT PRIMARY KEY,
     "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
     "tournamentId" TEXT NOT NULL REFERENCES "Tournament"(id) ON DELETE CASCADE,
     "playerId" TEXT NOT NULL REFERENCES "Player"(id) ON DELETE CASCADE,
     round INTEGER NOT NULL,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "daily_pred_unique" UNIQUE ("userId", "tournamentId", "round")
   )`,
  `CREATE INDEX IF NOT EXISTS "idx_daily_pred_tour" ON "DailyPrediction"("tournamentId")`,
  `CREATE INDEX IF NOT EXISTS "idx_daily_pred_user" ON "DailyPrediction"("userId")`,

  // --- Referral tracking ---
  `CREATE TABLE IF NOT EXISTS "Referral" (
     id TEXT PRIMARY KEY,
     "referrerId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
     "referredEmail" TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending',
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "idx_referral_referrer" ON "Referral"("referrerId")`,

  // --- Vouchers ---
  `CREATE TABLE IF NOT EXISTS "Voucher" (
     id TEXT PRIMARY KEY,
     code TEXT NOT NULL UNIQUE,
     "userId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
     "discountPercent" INTEGER NOT NULL DEFAULT 50,
     used BOOLEAN NOT NULL DEFAULT false,
     source TEXT NOT NULL DEFAULT 'referral',
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "idx_voucher_user" ON "Voucher"("userId")`,

  // --- User achievements ---
  `CREATE TABLE IF NOT EXISTS "UserAchievement" (
     id TEXT PRIMARY KEY,
     "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
     type TEXT NOT NULL,
     "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "achievement_unique" UNIQUE ("userId", "type")
   )`,
  `CREATE INDEX IF NOT EXISTS "idx_ach_user" ON "UserAchievement"("userId")`,

  // --- Blog posts ---
  `CREATE TABLE IF NOT EXISTS "BlogPost" (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     slug TEXT NOT NULL UNIQUE,
     body TEXT NOT NULL,
     author TEXT NOT NULL DEFAULT 'Fantasy Golf Team',
     excerpt TEXT,
     "publishedAt" TIMESTAMP(3),
     tags TEXT[],
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "idx_blog_slug" ON "BlogPost"(slug)`,
  `CREATE INDEX IF NOT EXISTS "idx_blog_published" ON "BlogPost"("publishedAt")`,
];

export async function ensureSchema(): Promise<void> {
  if (ensured) return;
  if (ensuring) return ensuring;
  ensuring = (async () => {
    for (const stmt of DDL) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch {
        // ignore — most likely table already exists with slightly different shape
      }
    }
    ensured = true;
  })();
  return ensuring;
}

/** Generate a 32-char hex id suitable for TEXT primary keys. */
export function genId(): string {
  // crypto.randomUUID is available in Node 16.7+
  try {
    const c = globalThis.crypto as any;
    if (typeof c?.randomUUID === "function") {
      return c.randomUUID().replace(/-/g, "");
    }
  } catch {
    /* ignore */
  }
  // Fallback
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

/** Generate a short human-readable code for vouchers / referrals. */
export function genCode(prefix = "FG"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = prefix + "-";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
