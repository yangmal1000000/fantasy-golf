import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const freezeSource = readFileSync(
  new URL("./rocket-field-freeze.ts", import.meta.url),
  "utf8",
);
const endpointSource = readFileSync(
  new URL("../app/api/sync/rocket-field/route.ts", import.meta.url),
  "utf8",
);
const workflowSource = readFileSync(
  new URL("../../.github/workflows/rocket-field-freeze.yml", import.meta.url),
  "utf8",
);
const middlewareSource = readFileSync(
  new URL("../middleware.ts", import.meta.url),
  "utf8",
);
const rankingSyncSource = readFileSync(
  new URL("./ranking-sync.ts", import.meta.url),
  "utf8",
);
const dataSyncSource = readFileSync(
  new URL("./data-sync.ts", import.meta.url),
  "utf8",
);
const recalcRouteSource = readFileSync(
  new URL("../app/api/sync/recalc-tiers/route.ts", import.meta.url),
  "utf8",
);

test("Rocket final-field freeze is tied to the correct official PGA TOUR field", () => {
  assert.match(freezeSource, /ROCKET_OFFICIAL_FIELD_ID = "R2026524"/);
  assert.match(
    freezeSource,
    /manifest\.officialFieldId !== ROCKET_OFFICIAL_FIELD_ID/,
  );
  assert.match(freezeSource, /source\.role === "FIELD_AUTHORITY"/);
  assert.match(freezeSource, /source\.role === "QUALIFIER_RESULTS"/);
});

test("Rocket final-field freeze requires all qualifiers and balanced field-relative tiers", () => {
  assert.match(freezeSource, /manifest\.qualifiers\.length !== 4/);
  assert.match(
    freezeSource,
    /Every Monday qualifier must appear in the final field/,
  );
  assert.match(
    freezeSource,
    /ROCKET_REQUIRED_TIERS = \[\.\.\.ROCKET_FIELD_TIER_ORDER\]/,
  );
  assert.match(freezeSource, /assignRocketFieldTiers/);
  assert.match(
    freezeSource,
    /if \(apply \|\| freeze\) \{\s*validateRocketFieldTiers\(/,
  );
  assert.match(freezeSource, /ROCKET_MIN_RANKED_PLAYERS/);
  assert.match(freezeSource, /ROCKET_FIELD_TIER_TARGET_COUNTS/);
  assert.match(freezeSource, /field-relative-10-10-10-20-rest/);
  assert.match(freezeSource, /action: "field_pre_freeze_snapshot"/);
  assert.match(freezeSource, /preFreezeSnapshotHash/);
});

test("generic ranking and score syncs cannot overwrite Rocket field-relative tiers", () => {
  assert.match(
    rankingSyncSource,
    /where: \{ tournamentId: \{ not: ROCKET_FIELD_TOURNAMENT_ID \} \}/,
  );
  assert.match(
    dataSyncSource,
    /where: \{ tournamentId: \{ not: ROCKET_FIELD_TOURNAMENT_ID \} \}/,
  );
  assert.match(
    dataSyncSource,
    /rocketFieldManaged = tournamentId === ROCKET_FIELD_TOURNAMENT_ID/,
  );
  assert.match(
    dataSyncSource,
    /if \(fieldIsFrozen \|\| rocketFieldManaged\) continue/,
  );
  assert.match(
    recalcRouteSource,
    /where: \{ tournamentId: \{ not: ROCKET_FIELD_TOURNAMENT_ID \} \}/,
  );
});

test("the production field endpoint is signed and supports safe stage/freeze modes", () => {
  assert.match(
    endpointSource,
    /adminApiGuard\(request, \{ allowCron: true \}\)/,
  );
  assert.match(endpointSource, /body\.mode !== "dry-run"/);
  assert.match(endpointSource, /body\.mode !== "apply"/);
  assert.match(freezeSource, /validateOfficialInitialManifest\(manifest\)/);
  assert.match(freezeSource, /ROCKET_COMMITMENT_DEADLINE/);
  assert.match(freezeSource, /Manifest contains a placeholder player/);
  assert.match(freezeSource, /provisionalFieldReadyAt/);
  assert.match(freezeSource, /reconcileDraftsForFinalField/);
  assert.match(workflowSource, /default: dry-run/);
  assert.match(workflowSource, /- apply/);
  assert.match(workflowSource, /secrets\.ROCKET_CRON_SECRET/);
  assert.match(workflowSource, /api\/sync\/rocket-field/);
  assert.match(middlewareSource, /pathname === "\/api\/sync\/rocket-field"/);
});
