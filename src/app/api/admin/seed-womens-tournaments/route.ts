import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminApiGuard } from "@/lib/admin-auth";

// ── Women's LPGA tournaments (5 majors) ──────────────────────────────────────
const WOMENS_TOURNAMENTS = [
  {
    id: "chevron-2026",
    name: "Chevron Championship 2026",
    course: "The Club at Carlton Woods",
    start: "2026-04-16",
    end: "2026-04-19",
    par: 72,
    category: "lpga_major",
    tour: "lpga",
    fee: 1000,
  },
  {
    id: "us-womens-open-2026",
    name: "U.S. Women's Open 2026",
    course: "Erin Hills",
    start: "2026-05-28",
    end: "2026-05-31",
    par: 72,
    category: "lpga_major",
    tour: "lpga",
    fee: 1000,
  },
  {
    id: "kpmg-womens-pga-2026",
    name: "KPMG Women's PGA Championship 2026",
    course: "Baltusrol Golf Club",
    start: "2026-06-25",
    end: "2026-06-28",
    par: 71,
    category: "lpga_major",
    tour: "lpga",
    fee: 1000,
  },
  {
    id: "amundi-evian-2026",
    name: "Amundi Evian Championship 2026",
    course: "Evian Resort Golf Club",
    start: "2026-07-23",
    end: "2026-07-26",
    par: 71,
    category: "lpga_major",
    tour: "lpga",
    fee: 1000,
  },
  {
    id: "aig-womens-open-2026",
    name: "AIG Women's Open 2026",
    course: "St Andrews (Old Course)",
    start: "2026-08-13",
    end: "2026-08-16",
    par: 72,
    category: "lpga_major",
    tour: "lpga",
    fee: 1000,
  },
] as const;

// ── Women's player pool (50 golfers) ─────────────────────────────────────────
// ID prefix "wplayer-" distinguishes from men's players.
// Tiers: T1_10 (1-10), T11_20 (11-20), T21_30 (21-30), T31_50 (31-50), T51_PLUS (51+)
type WPlayer = {
  id: string;
  name: string;
  country: string;
  rank: number;
};

const WOMENS_PLAYERS: WPlayer[] = [
  // ── T1_10 (ranks 1-10) ──────────────────────────────────────────────────
  { id: "wplayer-1", name: "Nelly Korda", country: "USA", rank: 1 },
  { id: "wplayer-2", name: "Lydia Ko", country: "NZL", rank: 2 },
  { id: "wplayer-3", name: "Atthaya Thitikul", country: "THA", rank: 3 },
  { id: "wplayer-4", name: "Jin Young Ko", country: "KOR", rank: 4 },
  { id: "wplayer-5", name: "Ruoning Yin", country: "CHN", rank: 5 },
  { id: "wplayer-6", name: "Lilia Vu", country: "USA", rank: 6 },
  { id: "wplayer-7", name: "Hyo Joo Kim", country: "KOR", rank: 7 },
  { id: "wplayer-8", name: "Minjee Lee", country: "AUS", rank: 8 },
  { id: "wplayer-9", name: "Celine Boutier", country: "FRA", rank: 9 },
  { id: "wplayer-10", name: "Ayaka Furue", country: "JPN", rank: 10 },

  // ── T11_20 (ranks 11-20) ────────────────────────────────────────────────
  { id: "wplayer-11", name: "Brooke Henderson", country: "CAN", rank: 11 },
  { id: "wplayer-12", name: "Georgia Hall", country: "ENG", rank: 12 },
  { id: "wplayer-13", name: "Charley Hull", country: "ENG", rank: 13 },
  { id: "wplayer-14", name: "Lexi Thompson", country: "USA", rank: 14 },
  { id: "wplayer-15", name: "Allisen Corpuz", country: "USA", rank: 15 },
  { id: "wplayer-16", name: "Maja Stark", country: "SWE", rank: 16 },
  { id: "wplayer-17", name: "Linnea Strom", country: "SWE", rank: 17 },
  { id: "wplayer-18", name: "Xiyu Lin", country: "CHN", rank: 18 },
  { id: "wplayer-19", name: "Megan Khang", country: "USA", rank: 19 },
  { id: "wplayer-20", name: "Carlota Ciganda", country: "ESP", rank: 20 },

  // ── T21_30 (ranks 21-30) ────────────────────────────────────────────────
  { id: "wplayer-21", name: "Rose Zhang", country: "USA", rank: 21 },
  { id: "wplayer-22", name: "Alison Lee", country: "USA", rank: 22 },
  { id: "wplayer-23", name: "Hae Ran Ryu", country: "KOR", rank: 23 },
  { id: "wplayer-24", name: "Jiyai Shin", country: "KOR", rank: 24 },
  { id: "wplayer-25", name: "Amy Yang", country: "KOR", rank: 25 },
  { id: "wplayer-26", name: "Perrine Delacour", country: "FRA", rank: 26 },
  { id: "wplayer-27", name: "Gaby Lopez", country: "MEX", rank: 27 },
  { id: "wplayer-28", name: "Andrea Lee", country: "USA", rank: 28 },
  { id: "wplayer-29", name: "Cheyenne Knight", country: "USA", rank: 29 },
  { id: "wplayer-30", name: "Elizabeth Szokol", country: "USA", rank: 30 },

  // ── T31_50 (ranks 31-50) ────────────────────────────────────────────────
  { id: "wplayer-31", name: "Bianca Pagdanganan", country: "PHI", rank: 31 },
  { id: "wplayer-32", name: "Pajaree Anannarukarn", country: "THA", rank: 32 },
  { id: "wplayer-33", name: "Wichanee Meechai", country: "THA", rank: 33 },
  { id: "wplayer-34", name: "Yan Liu", country: "CHN", rank: 34 },
  { id: "wplayer-35", name: "Ashleigh Buhai", country: "RSA", rank: 35 },
  { id: "wplayer-36", name: "Stephanie Kyriacou", country: "AUS", rank: 36 },
  { id: "wplayer-37", name: "Frida Kinhult", country: "SWE", rank: 37 },
  { id: "wplayer-38", name: "Caroline Hedwall", country: "SWE", rank: 38 },
  { id: "wplayer-39", name: "Dewi Weber", country: "NED", rank: 39 },
  { id: "wplayer-40", name: "Albane Valenzuela", country: "SUI", rank: 40 },

  // ── T51_PLUS (ranks 51+) ────────────────────────────────────────────────
  { id: "wplayer-41", name: "Inbee Park", country: "KOR", rank: 51 },
  { id: "wplayer-42", name: "So Yeon Ryu", country: "KOR", rank: 52 },
  { id: "wplayer-43", name: "In-Kyung Kim", country: "KOR", rank: 53 },
  { id: "wplayer-44", name: "Anna Nordqvist", country: "SWE", rank: 54 },
  { id: "wplayer-45", name: "Stacy Lewis", country: "USA", rank: 55 },
  { id: "wplayer-46", name: "Jessica Korda", country: "USA", rank: 56 },
  { id: "wplayer-47", name: "Danielle Kang", country: "USA", rank: 57 },
  { id: "wplayer-48", name: "Cristie Kerr", country: "USA", rank: 58 },
  { id: "wplayer-49", name: "Angela Stanford", country: "USA", rank: 59 },
  { id: "wplayer-50", name: "Karrie Webb", country: "AUS", rank: 60 },
];

function tierForRank(rank: number): string {
  if (rank <= 10) return "T1_10";
  if (rank <= 20) return "T11_20";
  if (rank <= 30) return "T21_30";
  if (rank <= 50) return "T31_50";
  return "T51_PLUS";
}

export async function POST(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    // Ensure Tour/Category columns exist (idempotent — mirrors seed-tournaments)
    await prisma.$executeRaw`ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'major'`;
    await prisma.$executeRaw`ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "tour" TEXT DEFAULT 'pga'`;

    // ── 1. Insert tournaments ────────────────────────────────────────────────
    let tournamentsCreated = 0;
    for (const t of WOMENS_TOURNAMENTS) {
      await prisma.$executeRaw`
        INSERT INTO "Tournament" (id, name, course, "startDate", "endDate", status, par, "entryFee", "currentRound", "prizePool", category, tour, "createdAt")
        VALUES (
          ${t.id},
          ${t.name},
          ${t.course},
          ${new Date(t.start)}::timestamptz,
          ${new Date(t.end)}::timestamptz,
          'upcoming',
          ${t.par},
          ${t.fee},
          0,
          0,
          ${t.category},
          ${t.tour},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          category = EXCLUDED.category,
          tour     = EXCLUDED.tour,
          par      = EXCLUDED.par
      `;
      tournamentsCreated++;
    }

    // ── 2. Insert players (wplayer- prefix) ──────────────────────────────────
    let playersCreated = 0;
    for (const p of WOMENS_PLAYERS) {
      await prisma.$executeRaw`
        INSERT INTO "Player" (id, name, country, "dataGolfRank", "createdAt")
        VALUES (${p.id}, ${p.name}, ${p.country}, ${p.rank}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name           = EXCLUDED.name,
          country        = EXCLUDED.country,
          "dataGolfRank" = EXCLUDED."dataGolfRank"
      `;
      playersCreated++;
    }

    // ── 3. Link players → tournaments (with tier) ───────────────────────────
    let linksCreated = 0;
    for (const t of WOMENS_TOURNAMENTS) {
      for (const p of WOMENS_PLAYERS) {
        const tier = tierForRank(p.rank);
        await prisma.$executeRaw`
          INSERT INTO "TournamentPlayer" (id, "tournamentId", "playerId", tier, "selectionCount", "withdrew")
          VALUES (gen_random_uuid(), ${t.id}, ${p.id}, ${tier}, 0, false)
          ON CONFLICT ("tournamentId", "playerId") DO NOTHING
        `;
        linksCreated++;
      }
    }

    const totalTournaments = await prisma.tournament.count();
    const totalPlayers = await prisma.player.count();
    const womensPlayers = await prisma.player.count({
      where: { id: { startsWith: "wplayer-" } },
    });

    return NextResponse.json({
      ok: true,
      tournamentsCreated,
      playersCreated,
      linksCreated,
      totalTournaments,
      totalPlayers,
      womensPlayers,
    });
  } catch (e) {
    console.error("seed-womens-tournaments error:", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}
