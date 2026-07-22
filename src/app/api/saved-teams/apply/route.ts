import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/saved-teams/apply
 *
 * Apply a saved team template to a tournament. Creates a Team and
 * TeamSelections for the current user.
 *
 * Body:
 *   - savedTeamId: string  (the template to apply)
 *   - tournamentId: string (the tournament to enter)
 *   - teamName?: string    (override team name)
 *   - replacementPicks?: Record<string, string>  (tier -> playerId, for players not in field)
 *
 * For any saved team player not in the tournament field, the caller must
 * supply a replacement pick via `replacementPicks`. If no replacement is
 * provided for a missing player, the slot is left empty and returned in
 * `missingSlots` so the UI can prompt the user.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    const {
      savedTeamId,
      tournamentId,
      teamName,
      replacementPicks = {},
    } = body as {
      savedTeamId: string;
      tournamentId: string;
      teamName?: string;
      replacementPicks?: Record<string, string>;
    };

    if (!savedTeamId || !tournamentId) {
      return NextResponse.json(
        { error: "savedTeamId and tournamentId are required" },
        { status: 400 },
      );
    }

    // Fetch the saved team — verify ownership
    const savedTeam = await prisma.savedTeam.findUnique({
      where: { id: savedTeamId },
      include: {
        players: {
          include: {
            player: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!savedTeam) {
      return NextResponse.json({ error: "Saved team not found" }, { status: 404 });
    }

    if (savedTeam.userId !== user.id) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 });
    }

    // Verify tournament exists and is open for entries
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, status: true, startDate: true },
    });

    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    if (tournament.status === "in_progress" || tournament.status === "completed") {
      return NextResponse.json(
        { error: "Tournament is already in progress or completed" },
        { status: 400 },
      );
    }

    // Check if user already has a team for this tournament
    const existingTeam = await prisma.team.findFirst({
      where: { userId: user.id, tournamentId },
    });
    if (existingTeam) {
      return NextResponse.json(
        { error: "You already have a team for this tournament", teamId: existingTeam.id },
        { status: 400 },
      );
    }

    // Fetch all TournamentPlayers for this tournament to map playerId -> tournamentPlayerId
    const tournamentPlayers = await prisma.tournamentPlayer.findMany({
      where: { tournamentId },
      include: { player: { select: { id: true, name: true } } },
    });

    const playerToTP = new Map<string, string>(); // playerId -> tournamentPlayerId
    const tierPlayers = new Map<string, { tournamentPlayerId: string; playerId: string; name: string }[]>(); // tier -> available players

    for (const tp of tournamentPlayers) {
      playerToTP.set(tp.playerId, tp.id);
      const tierList = tierPlayers.get(tp.tier) ?? [];
      tierList.push({
        tournamentPlayerId: tp.id,
        playerId: tp.playerId,
        name: tp.player.name,
      });
      tierPlayers.set(tp.tier, tierList);
    }

    // Build the final 5 picks, resolving replacements
    const picks: { tournamentPlayerId: string; tier: string; playerId: string; playerName: string; wasReplaced: boolean }[] = [];
    const missingSlots: { tier: string; originalPlayerName: string; available: { playerId: string; name: string }[] }[] = [];

    for (const slot of savedTeam.players) {
      const tpId = playerToTP.get(slot.playerId);

      if (tpId) {
        // Player is in the field — direct pick
        picks.push({
          tournamentPlayerId: tpId,
          tier: slot.tier,
          playerId: slot.playerId,
          playerName: slot.player.name,
          wasReplaced: false,
        });
      } else {
        // Player NOT in the field — check for a user-supplied replacement
        const replacementPlayerId = replacementPicks[slot.tier];

        if (replacementPlayerId) {
          // Validate the replacement is in the field and correct tier
          const replacementTPId = playerToTP.get(replacementPlayerId);
          const replacementTP = tournamentPlayers.find(
            (tp) => tp.playerId === replacementPlayerId && tp.tier === slot.tier,
          );

          if (!replacementTP) {
            return NextResponse.json(
              {
                error: `Replacement player for tier ${slot.tier} is not in the tournament field or wrong tier`,
              },
              { status: 400 },
            );
          }

          picks.push({
            tournamentPlayerId: replacementTPId!,
            tier: slot.tier,
            playerId: replacementPlayerId,
            playerName: replacementTP.player.name,
            wasReplaced: true,
          });
        } else {
          // No replacement provided — collect available players in this tier
          const available = (tierPlayers.get(slot.tier) ?? []).map((p) => ({
            playerId: p.playerId,
            name: p.name,
          }));

          missingSlots.push({
            tier: slot.tier,
            originalPlayerName: slot.player.name,
            available,
          });
        }
      }
    }

    // If any slots are missing and no replacement was provided, return them for the UI
    if (missingSlots.length > 0) {
      return NextResponse.json({
        needsReplacements: true,
        missingSlots,
        message: `${missingSlots.length} player(s) from your saved team are not in the tournament field. Please pick replacements.`,
      });
    }

    // Create the Team + TeamSelections
    const team = await prisma.team.create({
      data: {
        userId: user.id,
        tournamentId,
        name: teamName?.trim() || savedTeam.name,
        selections: {
          create: picks.map((pick) => ({
            tournamentPlayerId: pick.tournamentPlayerId,
          })),
        },
      },
      include: {
        selections: {
          include: {
            tournamentPlayer: {
              include: { player: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      team,
      success: true,
      replacementsMade: picks.filter((p) => p.wasReplaced).length,
    });
  } catch (err) {
    console.error("Saved team apply error:", err);
    return NextResponse.json({ error: "Failed to apply saved team" }, { status: 500 });
  }
}
