import { prisma } from "./prisma";

interface PayoutPosition {
  position: number;
  percentage: number;
}

export interface UserWinningsResult {
  totalWon: number; // pence
  netProfit: number; // totalWon - totalSpent (pence)
  breakdown: Array<{
    tournamentId: string;
    tournamentName: string;
    teamPosition: number | null;
    amount: number; // pence
    prizePool: number;
  }>;
}

/**
 * Calculate total winnings for a user across completed tournaments.
 *
 * Uses each tournament's prizePool and payoutStructure (JSON of
 * [{ position, percentage }]) combined with the user's stored team position.
 *
 * Returns zero totals if no payout structures are configured.
 */
export async function calculateUserWinnings(
  userId: string
): Promise<UserWinningsResult> {
  const teams = await prisma.team.findMany({
    where: {
      userId,
      tournament: { status: "completed" },
    },
    select: {
      id: true,
      position: true,
      tournament: {
        select: {
          id: true,
          name: true,
          entryFee: true,
          prizePool: true,
          payoutStructure: true,
        },
      },
    },
  });

  const breakdown: UserWinningsResult["breakdown"] = [];
  let totalWon = 0;
  let totalEntryFees = 0;

  for (const team of teams) {
    totalEntryFees += team.tournament.entryFee ?? 0;

    const structureRaw = team.tournament.payoutStructure;
    if (!structureRaw || team.position == null) continue;

    let structure: PayoutPosition[];
    try {
      structure = JSON.parse(structureRaw);
    } catch {
      continue;
    }

    if (!Array.isArray(structure) || structure.length === 0) continue;

    const match = structure.find((s) => s.position === team.position);
    if (!match || match.percentage <= 0) continue;

    const prizePool = team.tournament.prizePool || 0;
    const amount = Math.round((prizePool * match.percentage) / 100);

    totalWon += amount;
    breakdown.push({
      tournamentId: team.tournament.id,
      tournamentName: team.tournament.name,
      teamPosition: team.position,
      amount,
      prizePool,
    });
  }

  return {
    totalWon,
    netProfit: totalWon - totalEntryFees,
    breakdown,
  };
}
