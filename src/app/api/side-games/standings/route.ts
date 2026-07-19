import { NextRequest, NextResponse } from "next/server";
import {
  getTopGolferStandings,
  getDarkHorseStandings,
  getBestPerRound,
} from "@/lib/sidegames";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get("tournamentId");
    const type = searchParams.get("type");

    if (!tournamentId || !type) {
      return NextResponse.json(
        { error: "Missing required query params: tournamentId, type" },
        { status: 400 }
      );
    }

    const validTypes = ["top_golfer", "best_round", "dark_horse"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    if (type === "top_golfer") {
      const standings = await getTopGolferStandings(tournamentId);
      return NextResponse.json({ type, standings });
    }

    if (type === "dark_horse") {
      const standings = await getDarkHorseStandings(tournamentId);
      return NextResponse.json({ type, standings });
    }

    // best_round
    const perRound = await getBestPerRound(tournamentId);
    return NextResponse.json({ type, rounds: perRound });
  } catch (error) {
    console.error("[side-games/standings] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
