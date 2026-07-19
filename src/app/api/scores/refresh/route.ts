import { NextRequest, NextResponse } from "next/server";
import { fetchCbsLeaderboard, updateScoresFromScrape } from "@/lib/scoreScraper";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get("tournamentId");

    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId query param required" },
        { status: 400 }
      );
    }

    // Verify tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    // Fetch from CBS
    const result = await fetchCbsLeaderboard();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Scrape failed",
          playersFound: 0,
        },
        { status: 200 } // Return 200 with error info so client can display message
      );
    }

    if (result.players.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No players found on leaderboard page. The tournament may not have started yet.",
        playersFound: 0,
      });
    }

    // Update DB
    const updateResult = await updateScoresFromScrape(tournamentId, result.players);

    return NextResponse.json({
      success: true,
      playersScraped: result.players.length,
      created: updateResult.created,
      updated: updateResult.updated,
      unmatched: updateResult.unmatched.length,
      unmatchedNames: updateResult.unmatched.slice(0, 10), // first 10
    });
  } catch (err) {
    console.error("Score refresh error:", err);
    return NextResponse.json(
      { error: "Internal server error during score refresh" },
      { status: 500 }
    );
  }
}
