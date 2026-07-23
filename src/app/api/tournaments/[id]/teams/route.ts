import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  ROCKET_BETA_TOURNAMENT_ID,
  RocketBetaError,
  ensureRocketBetaCampaign,
  getRocketBetaStateForUser,
  requireRocketBetaEntryPass,
} from "@/lib/rocket-beta";
import {
  TeamEntryValidationError,
  validateTeamEntryPayload,
  validateTeamEntryPlayers,
} from "@/lib/team-entry-validation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(req);
    assertJsonRequest(req);
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in required" },
        { status: 401 }
      );
    }
    const userId = user.id;

    const { id: tournamentId } = await params;
    const { teamName, selections } = validateTeamEntryPayload(await req.json());

    // Verify tournament exists and entries are open
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    if (tournament.status !== "entries_open" && tournament.status !== "upcoming") {
      return NextResponse.json({ error: "Entries are closed" }, { status: 400 });
    }
    const isRocketBeta = tournament.id === ROCKET_BETA_TOURNAMENT_ID;
    if (isRocketBeta) {
      await ensureRocketBetaCampaign();
      const state = await getRocketBetaStateForUser(user);
      if (!state.approved) {
        return NextResponse.json(
          { error: "Test flight access unavailable" },
          { status: 403 },
        );
      }
      if (state.passState === "LOCKED") {
        return NextResponse.json(
          { error: "Complete Target to unlock your Rocket Classic Test Pass" },
          { status: 403 },
        );
      }
      if (state.passState === "REDEEMED") {
        return NextResponse.json(
          { error: "Your Rocket Classic Test Pass has already been used", teamId: state.teamId },
          { status: 409 },
        );
      }
    }

    // Verify each selection is from a different tier
    const tournamentPlayers = await prisma.tournamentPlayer.findMany({
      where: { id: { in: selections }, tournamentId },
    });

    validateTeamEntryPlayers(tournamentPlayers, selections);

    const team = await prisma.$transaction(
      async (tx) => {
        const beta = isRocketBeta
          ? await requireRocketBetaEntryPass(tx, user)
          : null;

        const created = await tx.team.create({
          data: {
            name: teamName,
            userId,
            tournamentId,
            selections: {
              create: selections.map((tpId) => ({
                tournamentPlayerId: tpId,
              })),
            },
          },
          include: { selections: true },
        });

        for (const tpId of selections) {
          await tx.tournamentPlayer.update({
            where: { id: tpId },
            data: { selectionCount: { increment: 1 } },
          });
        }

        if (beta) {
          const redeemed = await tx.rocketBetaPass.updateMany({
            where: { id: beta.pass.id, status: "UNLOCKED", teamId: null },
            data: { status: "REDEEMED", redeemedAt: new Date(), teamId: created.id },
          });
          if (redeemed.count !== 1) {
            throw new RocketBetaError("Your Rocket Classic Test Pass has already been used", 409);
          }
          await tx.rocketBetaAudit.create({
            data: {
              campaignId: beta.campaign.id,
              actorUserId: user.id,
              actorEmail: user.email.trim().toLowerCase(),
              action: "test_pass_redeemed",
              payload: {
                passId: beta.pass.id,
                teamId: created.id,
                tournamentId,
              },
            },
          });
        }

        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json({
      teamId: team.id,
      success: true,
      betaPassRedeemed: isRocketBeta,
    });
  } catch (err) {
    console.error("Team creation error:", err);
    if (err instanceof RocketBetaError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof TeamEntryValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A team has already been submitted for this Test Pass" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 }
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
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new RocketBetaError("Content-Type must be application/json", 415);
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(contentLength) || contentLength > 32_768) {
    throw new RocketBetaError("Request body is too large", 413);
  }
}
