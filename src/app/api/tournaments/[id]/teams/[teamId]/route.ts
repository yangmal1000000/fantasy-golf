import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ROCKET_BETA_CAMPAIGN_SLUG,
  ROCKET_BETA_TOURNAMENT_ID,
  RocketBetaError,
} from "@/lib/rocket-beta";
import {
  TeamEntryValidationError,
  validateTeamEntryPayload,
  validateTeamEntryPlayers,
} from "@/lib/team-entry-validation";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

export async function PUT(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; teamId: string }> },
) {
  try {
    assertSameOrigin(request);
    assertJsonRequest(request);

    const [user, { id: tournamentId, teamId }] = await Promise.all([
      getCurrentUser(),
      params,
    ]);
    if (!user) {
      return privateJson({ error: "Sign in required" }, { status: 401 });
    }
    if (tournamentId !== ROCKET_BETA_TOURNAMENT_ID) {
      return privateJson({ error: "Not found" }, { status: 404 });
    }

    const { teamName, selections } = validateTeamEntryPayload(
      await request.json(),
    );

    await prisma.$transaction(
      async (tx) => {
        const campaign = await tx.rocketBetaCampaign.findUnique({
          where: { slug: ROCKET_BETA_CAMPAIGN_SLUG },
        });
        if (!campaign || campaign.status !== "OPEN") {
          throw new RocketBetaError(
            "Rocket Classic team changes are not open",
            409,
          );
        }
        if (campaign.entryClosesAt && new Date() >= campaign.entryClosesAt) {
          throw new RocketBetaError(
            "Rocket Classic teams locked at first tee",
            409,
          );
        }
        if (!campaign.fieldFrozenAt || !campaign.fieldHash) {
          throw new RocketBetaError(
            "The reviewed Rocket Classic field is not open yet",
            409,
          );
        }

        const [team, pass, players] = await Promise.all([
          tx.team.findFirst({
            where: {
              id: teamId,
              userId: user.id,
              tournamentId,
            },
            include: { selections: true },
          }),
          tx.rocketBetaPass.findUnique({
            where: {
              campaignId_userId: {
                campaignId: campaign.id,
                userId: user.id,
              },
            },
          }),
          tx.tournamentPlayer.findMany({
            where: { id: { in: selections }, tournamentId },
          }),
        ]);

        if (!team) {
          throw new RocketBetaError("Team not found", 404);
        }
        if (
          !pass ||
          pass.status !== "REDEEMED" ||
          pass.teamId !== team.id
        ) {
          throw new RocketBetaError(
            "This Test Pass is not linked to that team",
            403,
          );
        }

        validateTeamEntryPlayers(players, selections);

        const currentIds = new Set(
          team.selections.map((selection) => selection.tournamentPlayerId),
        );
        const nextIds = new Set(selections);
        const removed = [...currentIds].filter((id) => !nextIds.has(id));
        const added = [...nextIds].filter((id) => !currentIds.has(id));

        if (removed.length > 0) {
          await tx.tournamentPlayer.updateMany({
            where: { id: { in: removed }, tournamentId },
            data: { selectionCount: { decrement: 1 } },
          });
        }
        if (added.length > 0) {
          await tx.tournamentPlayer.updateMany({
            where: { id: { in: added }, tournamentId },
            data: { selectionCount: { increment: 1 } },
          });
        }

        await tx.teamSelection.deleteMany({ where: { teamId: team.id } });
        await tx.teamSelection.createMany({
          data: selections.map((tournamentPlayerId) => ({
            teamId: team.id,
            tournamentPlayerId,
          })),
        });
        await tx.team.update({
          where: { id: team.id },
          data: { name: teamName },
        });
        await tx.rocketBetaAudit.create({
          data: {
            campaignId: campaign.id,
            actorUserId: user.id,
            actorEmail: user.email.trim().toLowerCase(),
            action: "rocket_team_updated_before_lock",
            payload: {
              teamId: team.id,
              removedTournamentPlayerIds: removed,
              addedTournamentPlayerIds: added,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return privateJson({
      success: true,
      updated: true,
      teamId,
      betaPassRedeemed: true,
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
    console.error("Rocket team update error", error);
    return privateJson(
      { error: "Unable to update the Rocket team" },
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
