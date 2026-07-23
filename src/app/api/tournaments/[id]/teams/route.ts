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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(req);
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in required" },
        { status: 401 }
      );
    }
    const userId = user.id;

    const { id: tournamentId } = await params;
    const body = await req.json();

    const { teamName, selections } = body as {
      teamName: string;
      selections: string[]; // tournamentPlayerIds
    };

    // Validate
    if (!teamName?.trim()) {
      return NextResponse.json({ error: "Team name required" }, { status: 400 });
    }

    if (!selections || selections.length !== 5) {
      return NextResponse.json(
        { error: "Must select exactly 5 players (one per tier)" },
        { status: 400 }
      );
    }
    if (new Set(selections).size !== selections.length) {
      return NextResponse.json(
        { error: "Each player may be selected only once" },
        { status: 400 },
      );
    }

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
        return NextResponse.json({ error: "Beta access required" }, { status: 404 });
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

    if (tournamentPlayers.length !== 5) {
      return NextResponse.json(
        { error: "Invalid player selections" },
        { status: 400 }
      );
    }

    const tiers = new Set(tournamentPlayers.map((tp) => tp.tier));
    if (tiers.size !== 5) {
      return NextResponse.json(
        { error: "Must pick one player from each of the 5 tiers" },
        { status: 400 }
      );
    }

    const team = await prisma.$transaction(
      async (tx) => {
        const beta = isRocketBeta
          ? await requireRocketBetaEntryPass(tx, user)
          : null;

        const created = await tx.team.create({
          data: {
            name: teamName.trim(),
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
