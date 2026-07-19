import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/season-tournaments?year=2027
 *
 * Returns all tournaments for the given year with player and team counts.
 * Used by the Season Management admin page.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year"));

    if (!year) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid year parameter" },
        { status: 400 }
      );
    }

    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    const tournaments = await prisma.tournament.findMany({
      where: {
        startDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        category: true,
        tour: true,
        startDate: true,
        endDate: true,
        _count: {
          select: {
            players: true,
            teams: true,
          },
        },
      },
    });

    const formatted = tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      category: t.category,
      tour: t.tour,
      startDate: t.startDate.toISOString(),
      endDate: t.endDate.toISOString(),
      playerCount: t._count.players,
      teamCount: t._count.teams,
    }));

    return NextResponse.json({ ok: true, year, tournaments: formatted });
  } catch (e) {
    console.error("season-tournaments error:", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}
