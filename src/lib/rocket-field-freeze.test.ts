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

test("Rocket final-field freeze is tied to the correct official PGA TOUR field", () => {
  assert.match(freezeSource, /ROCKET_OFFICIAL_FIELD_ID = "R2026524"/);
  assert.match(
    freezeSource,
    /manifest\.officialFieldId !== ROCKET_OFFICIAL_FIELD_ID/,
  );
  assert.match(freezeSource, /source\.role === "FIELD_AUTHORITY"/);
  assert.match(freezeSource, /source\.role === "QUALIFIER_RESULTS"/);
});

test("Rocket final-field freeze requires all qualifiers and all five tiers", () => {
  assert.match(freezeSource, /manifest\.qualifiers\.length !== 4/);
  assert.match(
    freezeSource,
    /Every Monday qualifier must appear in the final field/,
  );
  assert.match(
    freezeSource,
    /ROCKET_REQUIRED_TIERS = \[[\s\S]*"T1_10"[\s\S]*"T51_PLUS"[\s\S]*\]/,
  );
  assert.match(freezeSource, /if \(freeze\) validateFrozenTiers\(tierCounts\)/);
  assert.match(freezeSource, /action: "field_pre_freeze_snapshot"/);
  assert.match(freezeSource, /preFreezeSnapshotHash/);
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
