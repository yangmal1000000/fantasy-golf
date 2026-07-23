import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ROCKET_BETA_TOURNAMENT_ID,
  RocketBetaError,
  getRocketBetaStateForUser,
} from "@/lib/rocket-beta";
import {
  TEAM_ENTRY_TIERS,
  TeamEntryValidationError,
  validateTeamEntryPayload,
  validateTeamEntryPlayers,
} from "@/lib/team-entry-validation";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    assertJsonRequest(request);

    const [user, { id: tournamentId }] = await Promise.all([
      getCurrentUser(),
      params,
    ]);
    if (!user) {
      return privateJson({ error: "Sign in required" }, { status: 401 });
    }
    if (!user.isAdmin || tournamentId !== ROCKET_BETA_TOURNAMENT_ID) {
      return privateJson({ error: "Not found" }, { status: 404 });
    }

    const state = await getRocketBetaStateForUser(user);
    if (!state.approved || state.passState !== "UNLOCKED") {
      return privateJson(
        { error: "An unlocked Rocket Test Pass is required" },
        { status: 403 },
      );
    }
    if (state.fieldReady) {
      return privateJson(
        { error: "The official field is ready. Use the real team entry flow." },
        { status: 409 },
      );
    }

    const { teamName, selections } = validateTeamEntryPayload(
      await request.json(),
    );
    const players = await prisma.tournamentPlayer.findMany({
      where: {
        id: { in: selections },
        tournamentId,
      },
      include: {
        player: {
          select: {
            name: true,
            country: true,
            dataGolfRank: true,
          },
        },
      },
    });
    validateTeamEntryPlayers(players, selections);

    const tierOrder = new Map(
      TEAM_ENTRY_TIERS.map((tier, index) => [tier as string, index]),
    );
    return privateJson({
      ok: true,
      dryRun: true,
      passState: "UNLOCKED",
      team: {
        name: teamName,
        players: players
          .sort(
            (left, right) =>
              (tierOrder.get(left.tier) ?? 99) -
              (tierOrder.get(right.tier) ?? 99),
          )
          .map((entry) => ({
            tournamentPlayerId: entry.id,
            tier: entry.tier,
            name: entry.player.name,
            country: entry.player.country,
            dataGolfRank: entry.player.dataGolfRank,
          })),
      },
    });
  } catch (error) {
    if (
      error instanceof RocketBetaError ||
      error instanceof TeamEntryValidationError
    ) {
      return privateJson(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("Rocket team preview error", error);
    return privateJson(
      { error: "Unable to validate the dry-run team" },
      { status: 500 },
    );
  }
}

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new RocketBetaError("Cross-site request blocked", 403);
  }
}

function assertJsonRequest(request: NextRequest) {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    throw new RocketBetaError("Content-Type must be application/json", 415);
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(contentLength) || contentLength > 32_768) {
    throw new RocketBetaError("Request body is too large", 413);
  }
}

function privateJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...PRIVATE_HEADERS, ...init?.headers },
  });
}
