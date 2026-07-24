import assert from "node:assert/strict";
import test from "node:test";
import {
  assignRocketFieldTiers,
  ROCKET_FIELD_TIER_COPY,
  rocketTierForFieldPosition,
} from "./rocket-tiers";

test("Rocket uses balanced field-relative tiers for a 142-player field", () => {
  const candidates = Array.from({ length: 142 }, (_, index) => ({
    name: `Golfer ${String(index + 1).padStart(3, "0")}`,
    rank: index < 97 ? index * 2 + 3 : null,
  }));
  const assigned = assignRocketFieldTiers(candidates.reverse());
  const counts = assigned.reduce<Record<string, number>>((result, player) => {
    result[player.tier] = (result[player.tier] ?? 0) + 1;
    return result;
  }, {});

  assert.deepEqual(counts, {
    T1_10: 10,
    T11_20: 10,
    T21_30: 10,
    T31_50: 20,
    T51_PLUS: 92,
  });
  assert.equal(assigned[0].rank, 3);
  assert.equal(assigned[49].rank, 101);
  assert.equal(assigned[97].rank, null);
});

test("field positions, rather than absolute world-rank bands, choose the tier", () => {
  assert.equal(rocketTierForFieldPosition(1), "T1_10");
  assert.equal(rocketTierForFieldPosition(10), "T1_10");
  assert.equal(rocketTierForFieldPosition(11), "T11_20");
  assert.equal(rocketTierForFieldPosition(21), "T21_30");
  assert.equal(rocketTierForFieldPosition(31), "T31_50");
  assert.equal(rocketTierForFieldPosition(51), "T51_PLUS");

  const assigned = assignRocketFieldTiers(
    Array.from({ length: 55 }, (_, index) => ({
      name: `Entrant ${index + 1}`,
      rank: 100 + index * 3,
    })),
  );
  assert.equal(assigned[0].rank, 100);
  assert.equal(assigned[0].tier, "T1_10");
  assert.equal(assigned[10].rank, 130);
  assert.equal(assigned[10].tier, "T11_20");
});

test("unranked golfers sort after ranked golfers with a stable name fallback", () => {
  const assigned = assignRocketFieldTiers([
    { name: "Zulu Qualifier", rank: null },
    { name: "Ranked Golfer", rank: 450 },
    { name: "Álpha Qualifier", rank: null },
  ]);
  assert.deepEqual(
    assigned.map((player) => player.name),
    ["Ranked Golfer", "Álpha Qualifier", "Zulu Qualifier"],
  );
});

test("Rocket labels explain that tiers are relative to this event", () => {
  assert.equal(
    ROCKET_FIELD_TIER_COPY.T1_10.label,
    "Tier 1 · Top 10 in this field",
  );
  assert.match(
    ROCKET_FIELD_TIER_COPY.T51_PLUS.description,
    /remaining ranked and unranked golfers/,
  );
});
