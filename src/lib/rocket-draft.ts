import { TEAM_ENTRY_TIERS } from "@/lib/team-entry-validation";

export type RocketDraftStatus = "PROVISIONAL" | "FINAL_RECONCILED";

export interface RocketDraftPick {
  tier: string;
  playerId: string;
  playerName: string;
  rank: number | null;
}

export interface RocketDraft {
  schemaVersion: 1;
  tournamentId: "rocket-classic";
  teamName: string;
  fieldVersion: string;
  fieldHash: string;
  status: RocketDraftStatus;
  picks: RocketDraftPick[];
  savedAt: string;
  reconciledAt?: string;
}

export type RocketReserveCandidate = RocketDraftPick;

export interface RocketDraftChange {
  tier: string;
  oldPlayerId: string;
  oldPlayerName: string;
  oldRank: number | null;
  newPlayerId: string;
  newPlayerName: string;
  newRank: number | null;
  reason: "REMOVED" | "WITHDRAWN" | "TIER_CHANGED";
}

export function parseRocketDraft(value: unknown): RocketDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<RocketDraft>;
  if (
    draft.schemaVersion !== 1 ||
    draft.tournamentId !== "rocket-classic" ||
    typeof draft.teamName !== "string" ||
    !draft.teamName.trim() ||
    typeof draft.fieldVersion !== "string" ||
    !draft.fieldVersion ||
    typeof draft.fieldHash !== "string" ||
    !draft.fieldHash ||
    (draft.status !== "PROVISIONAL" && draft.status !== "FINAL_RECONCILED") ||
    !Array.isArray(draft.picks) ||
    typeof draft.savedAt !== "string" ||
    Number.isNaN(Date.parse(draft.savedAt))
  ) {
    return null;
  }

  const picks = draft.picks.filter(isRocketDraftPick);
  if (
    picks.length !== TEAM_ENTRY_TIERS.length ||
    new Set(picks.map((pick) => pick.tier)).size !== TEAM_ENTRY_TIERS.length ||
    TEAM_ENTRY_TIERS.some(
      (tier) => !picks.some((pick) => pick.tier === tier),
    ) ||
    new Set(picks.map((pick) => pick.playerId)).size !== picks.length
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    tournamentId: "rocket-classic",
    teamName: draft.teamName.trim(),
    fieldVersion: draft.fieldVersion,
    fieldHash: draft.fieldHash,
    status: draft.status,
    picks,
    savedAt: draft.savedAt,
    ...(draft.reconciledAt && !Number.isNaN(Date.parse(draft.reconciledAt))
      ? { reconciledAt: draft.reconciledAt }
      : {}),
  };
}

export function chooseNearestRankReserve(
  removed: Pick<RocketDraftPick, "playerId" | "rank">,
  candidates: RocketReserveCandidate[],
  excludedPlayerIds: ReadonlySet<string> = new Set(),
) {
  return (
    candidates
      .filter(
        (candidate) =>
          candidate.playerId !== removed.playerId &&
          !excludedPlayerIds.has(candidate.playerId),
      )
      .sort((left, right) =>
        compareReserveCandidates(left, right, removed.rank),
      )[0] ?? null
  );
}

export function reconcileRocketDraft(
  draft: RocketDraft,
  finalRoster: RocketReserveCandidate[],
  input: {
    fieldVersion: string;
    fieldHash: string;
    reconciledAt: string;
    withdrawnPlayerIds?: ReadonlySet<string>;
  },
) {
  const rosterById = new Map(
    finalRoster.map((candidate) => [candidate.playerId, candidate]),
  );
  const withdrawn = input.withdrawnPlayerIds ?? new Set<string>();
  const currentByTier = new Map(draft.picks.map((pick) => [pick.tier, pick]));
  const nextByTier = new Map<string, RocketDraftPick>();
  const usedPlayerIds = new Set<string>();
  const invalidTiers = new Map<
    string,
    { pick: RocketDraftPick; reason: RocketDraftChange["reason"] }
  >();

  for (const tier of TEAM_ENTRY_TIERS) {
    const pick = currentByTier.get(tier);
    if (!pick) continue;
    const current = rosterById.get(pick.playerId);
    if (!current) {
      invalidTiers.set(tier, { pick, reason: "REMOVED" });
      continue;
    }
    if (withdrawn.has(pick.playerId)) {
      invalidTiers.set(tier, { pick, reason: "WITHDRAWN" });
      continue;
    }
    if (current.tier !== tier) {
      invalidTiers.set(tier, { pick, reason: "TIER_CHANGED" });
      continue;
    }
    nextByTier.set(tier, current);
    usedPlayerIds.add(current.playerId);
  }

  const changes: RocketDraftChange[] = [];
  for (const tier of TEAM_ENTRY_TIERS) {
    const invalid = invalidTiers.get(tier);
    if (!invalid) continue;
    const replacement = chooseNearestRankReserve(
      invalid.pick,
      finalRoster.filter(
        (candidate) =>
          candidate.tier === tier && !withdrawn.has(candidate.playerId),
      ),
      usedPlayerIds,
    );
    if (!replacement) {
      throw new Error(`No reserve is available for ${tier}`);
    }
    nextByTier.set(tier, replacement);
    usedPlayerIds.add(replacement.playerId);
    changes.push({
      tier,
      oldPlayerId: invalid.pick.playerId,
      oldPlayerName: invalid.pick.playerName,
      oldRank: invalid.pick.rank,
      newPlayerId: replacement.playerId,
      newPlayerName: replacement.playerName,
      newRank: replacement.rank,
      reason: invalid.reason,
    });
  }

  const picks = TEAM_ENTRY_TIERS.map((tier) => nextByTier.get(tier));
  if (picks.some((pick) => !pick)) {
    throw new Error("Reconciled draft is missing a tier");
  }

  return {
    draft: {
      ...draft,
      fieldVersion: input.fieldVersion,
      fieldHash: input.fieldHash,
      status: "FINAL_RECONCILED" as const,
      picks: picks as RocketDraftPick[],
      reconciledAt: input.reconciledAt,
    },
    changes,
  };
}

function isRocketDraftPick(value: unknown): value is RocketDraftPick {
  if (!value || typeof value !== "object") return false;
  const pick = value as Partial<RocketDraftPick>;
  return (
    typeof pick.tier === "string" &&
    TEAM_ENTRY_TIERS.includes(pick.tier as (typeof TEAM_ENTRY_TIERS)[number]) &&
    typeof pick.playerId === "string" &&
    pick.playerId.length > 0 &&
    typeof pick.playerName === "string" &&
    pick.playerName.trim().length > 0 &&
    (pick.rank === null ||
      (typeof pick.rank === "number" &&
        Number.isInteger(pick.rank) &&
        pick.rank > 0))
  );
}

function compareReserveCandidates(
  left: RocketReserveCandidate,
  right: RocketReserveCandidate,
  removedRank: number | null,
) {
  if (removedRank === null) {
    const leftUnranked = left.rank === null;
    const rightUnranked = right.rank === null;
    if (leftUnranked !== rightUnranked) return leftUnranked ? -1 : 1;
    if (left.rank !== right.rank) {
      return (right.rank ?? 0) - (left.rank ?? 0);
    }
    return compareNames(left.playerName, right.playerName);
  }

  const leftDistance =
    left.rank === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(left.rank - removedRank);
  const rightDistance =
    right.rank === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(right.rank - removedRank);
  if (leftDistance !== rightDistance) return leftDistance - rightDistance;

  const leftSide = left.rank === null ? 2 : left.rank >= removedRank ? 0 : 1;
  const rightSide = right.rank === null ? 2 : right.rank >= removedRank ? 0 : 1;
  if (leftSide !== rightSide) return leftSide - rightSide;

  if (left.rank !== right.rank) {
    return (
      (left.rank ?? Number.MAX_SAFE_INTEGER) -
      (right.rank ?? Number.MAX_SAFE_INTEGER)
    );
  }
  return compareNames(left.playerName, right.playerName);
}

function compareNames(left: string, right: string) {
  return left.localeCompare(right, "en", { sensitivity: "base" });
}
