export const ROCKET_FIELD_TOURNAMENT_ID = "rocket-classic";

export const ROCKET_FIELD_TIER_ORDER = [
  "T1_10",
  "T11_20",
  "T21_30",
  "T31_50",
  "T51_PLUS",
] as const;

export type RocketFieldTier = (typeof ROCKET_FIELD_TIER_ORDER)[number];

export const ROCKET_MIN_RANKED_PLAYERS = 50;

export const ROCKET_FIELD_TIER_TARGET_COUNTS: Record<
  Exclude<RocketFieldTier, "T51_PLUS">,
  number
> = {
  T1_10: 10,
  T11_20: 10,
  T21_30: 10,
  T31_50: 20,
};

export const ROCKET_FIELD_TIER_COPY: Record<
  RocketFieldTier,
  { label: string; description: string }
> = {
  T1_10: {
    label: "Tier 1 · Top 10 in this field",
    description: "The 10 highest world-ranked golfers in this event",
  },
  T11_20: {
    label: "Tier 2 · Field ranks 11–20",
    description: "The next 10 golfers in this event by world ranking",
  },
  T21_30: {
    label: "Tier 3 · Field ranks 21–30",
    description: "Golfers 21–30 in this event by world ranking",
  },
  T31_50: {
    label: "Tier 4 · Field ranks 31–50",
    description: "Golfers 31–50 in this event by world ranking",
  },
  T51_PLUS: {
    label: "Tier 5 · Remaining field",
    description: "All remaining ranked and unranked golfers in this event",
  },
};

export type RocketTierCandidate = {
  name: string;
  rank: number | null;
};

function stableNameKey(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function rocketTierForFieldPosition(
  fieldPosition: number,
): RocketFieldTier {
  if (fieldPosition <= 10) return "T1_10";
  if (fieldPosition <= 20) return "T11_20";
  if (fieldPosition <= 30) return "T21_30";
  if (fieldPosition <= 50) return "T31_50";
  return "T51_PLUS";
}

export function assignRocketFieldTiers<T extends RocketTierCandidate>(
  candidates: T[],
): Array<T & { fieldPosition: number; tier: RocketFieldTier }> {
  return [...candidates]
    .sort((left, right) => {
      if (left.rank === null && right.rank !== null) return 1;
      if (left.rank !== null && right.rank === null) return -1;
      if (
        left.rank !== null &&
        right.rank !== null &&
        left.rank !== right.rank
      ) {
        return left.rank - right.rank;
      }
      return stableNameKey(left.name).localeCompare(stableNameKey(right.name));
    })
    .map((candidate, index) => {
      const fieldPosition = index + 1;
      return {
        ...candidate,
        fieldPosition,
        tier: rocketTierForFieldPosition(fieldPosition),
      };
    });
}

export function rocketTierCopy(tier: string) {
  return ROCKET_FIELD_TIER_COPY[tier as RocketFieldTier] ?? null;
}
