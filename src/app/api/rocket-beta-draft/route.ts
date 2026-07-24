import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ROCKET_BETA_CAMPAIGN_SLUG,
  ROCKET_BETA_TOURNAMENT_ID,
  RocketBetaError,
  ensureRocketBetaCampaign,
  getRocketBetaStateForUser,
} from "@/lib/rocket-beta";
import type { RocketDraft } from "@/lib/rocket-draft";
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

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    assertJsonRequest(request);
    const user = await getCurrentUser();
    if (!user) {
      return privateJson({ error: "Sign in required" }, { status: 401 });
    }

    await ensureRocketBetaCampaign();
    const state = await getRocketBetaStateForUser(user);
    if (!state.approved) {
      throw new RocketBetaError("Test flight access unavailable", 403);
    }
    if (state.passState !== "UNLOCKED") {
      throw new RocketBetaError(
        state.passState === "LOCKED"
          ? "Complete Target to unlock your Rocket Classic Test Pass"
          : "Your Rocket Classic Test Pass has already been used",
        state.passState === "LOCKED" ? 403 : 409,
      );
    }

    const { teamName, selections } = validateTeamEntryPayload(
      await request.json(),
    );
    const savedAt = new Date();

    const draft = await prisma.$transaction(
      async (tx) => {
        const campaign = await tx.rocketBetaCampaign.findUnique({
          where: { slug: ROCKET_BETA_CAMPAIGN_SLUG },
        });
        if (!campaign || campaign.status !== "OPEN") {
          throw new RocketBetaError("Rocket Classic drafting is not open", 409);
        }
        if (campaign.entryClosesAt && savedAt >= campaign.entryClosesAt) {
          throw new RocketBetaError(
            "Rocket Classic entries locked at first tee",
            409,
          );
        }
        if (campaign.fieldFrozenAt) {
          throw new RocketBetaError(
            "The final field is ready. Review and confirm your official team.",
            409,
          );
        }
        if (
          !campaign.provisionalFieldReadyAt ||
          !campaign.fieldVersion ||
          !campaign.fieldHash
        ) {
          throw new RocketBetaError(
            "The official initial PGA TOUR field is not ready for drafting",
            409,
          );
        }

        const [pass, players] = await Promise.all([
          tx.rocketBetaPass.findUnique({
            where: {
              campaignId_userId: {
                campaignId: campaign.id,
                userId: user.id,
              },
            },
          }),
          tx.tournamentPlayer.findMany({
            where: {
              id: { in: selections },
              tournamentId: ROCKET_BETA_TOURNAMENT_ID,
            },
            include: {
              player: {
                select: {
                  id: true,
                  name: true,
                  dataGolfRank: true,
                },
              },
            },
          }),
        ]);
        if (!pass || pass.status !== "UNLOCKED" || pass.teamId) {
          throw new RocketBetaError(
            "Your Rocket Classic Test Pass is not available",
            409,
          );
        }

        validateTeamEntryPlayers(players, selections);
        const playerByTournamentId = new Map(
          players.map((player) => [player.id, player]),
        );
        const draftValue: RocketDraft = {
          schemaVersion: 1,
          tournamentId: "rocket-classic",
          teamName,
          fieldVersion: campaign.fieldVersion,
          fieldHash: campaign.fieldHash,
          status: "PROVISIONAL",
          picks: selections.map((tournamentPlayerId) => {
            const entry = playerByTournamentId.get(tournamentPlayerId);
            if (!entry) {
              throw new TeamEntryValidationError(
                "Invalid provisional player selection",
              );
            }
            return {
              tier: entry.tier,
              playerId: entry.playerId,
              playerName: entry.player.name,
              rank: entry.player.dataGolfRank,
            };
          }),
          savedAt: savedAt.toISOString(),
        };

        const updated = await tx.rocketBetaPass.updateMany({
          where: {
            id: pass.id,
            status: "UNLOCKED",
            teamId: null,
          },
          data: {
            draftTeam: draftValue as unknown as Prisma.InputJsonValue,
            draftUpdatedAt: savedAt,
            draftFieldVersion: campaign.fieldVersion,
          },
        });
        if (updated.count !== 1) {
          throw new RocketBetaError(
            "Your Test Pass changed while the draft was saving",
            409,
          );
        }

        await tx.rocketBetaAudit.create({
          data: {
            campaignId: campaign.id,
            actorUserId: user.id,
            actorEmail: user.email.trim().toLowerCase(),
            action: pass.draftTeam
              ? "rocket_provisional_draft_updated"
              : "rocket_provisional_draft_saved",
            payload: {
              passId: pass.id,
              fieldVersion: campaign.fieldVersion,
              fieldHash: campaign.fieldHash,
              playerIds: draftValue.picks.map((pick) => pick.playerId),
            } as Prisma.InputJsonValue,
          },
        });
        return draftValue;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return privateJson({
      ok: true,
      draftSaved: true,
      officialTeamCreated: false,
      passRedeemed: false,
      draft,
    });
  } catch (error) {
    if (
      error instanceof RocketBetaError ||
      error instanceof TeamEntryValidationError
    ) {
      return privateJson({ error: error.message }, { status: error.status });
    }
    console.error("Rocket provisional draft error", error);
    return privateJson(
      { error: "Unable to save the Rocket provisional draft" },
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
