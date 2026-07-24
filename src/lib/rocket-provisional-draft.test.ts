import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(
  new URL("../../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const draftRoute = readFileSync(
  new URL("../app/api/rocket-beta-draft/route.ts", import.meta.url),
  "utf8",
);
const entryPage = readFileSync(
  new URL("../app/tournaments/[id]/enter/page.tsx", import.meta.url),
  "utf8",
);
const entryForm = readFileSync(
  new URL("../app/tournaments/[id]/enter/TeamEntryForm.tsx", import.meta.url),
  "utf8",
);
const tournamentPage = readFileSync(
  new URL("../app/tournaments/[id]/page.tsx", import.meta.url),
  "utf8",
);
const teamRoute = readFileSync(
  new URL("../app/api/tournaments/[id]/teams/route.ts", import.meta.url),
  "utf8",
);
const autoSub = readFileSync(new URL("./auto-sub.ts", import.meta.url), "utf8");

test("a Rocket provisional draft is stored on the unlocked pass without creating a team", () => {
  assert.match(schema, /draftTeam\s+Json\?/);
  assert.match(schema, /draftUpdatedAt\s+DateTime\?/);
  assert.match(schema, /provisionalFieldReadyAt\s+DateTime\?/);
  assert.match(draftRoute, /pass\.status !== "UNLOCKED"/);
  assert.match(draftRoute, /draftTeam: draftValue/);
  assert.match(draftRoute, /officialTeamCreated: false/);
  assert.match(draftRoute, /passRedeemed: false/);
  assert.doesNotMatch(draftRoute, /tx\.team\.create/);
});

test("weekend drafting is explicit and final confirmation reuses then clears the draft", () => {
  assert.match(entryPage, /Official initial field · draft mode/);
  assert.match(entryPage, /Four Monday qualifiers/);
  assert.match(entryForm, /Save provisional draft/);
  assert.match(entryForm, /No official team was created/);
  assert.match(teamRoute, /provisionalDraftUsed/);
  assert.match(teamRoute, /draftTeam: Prisma\.DbNull/);
});

test("Rocket entry explains its field-relative tier structure", () => {
  assert.match(entryForm, /Rocket field tiers/);
  assert.match(
    entryForm,
    /Top 10 · next 10 · next 10 · next 20 · remaining field/,
  );
  assert.match(entryForm, /rocketTierCopy\(tier\)/);
  assert.match(entryForm, /current world ranking is still/);
  assert.match(
    entryPage,
    /fieldRelativeTiers=\{Boolean\([\s\S]*provisionalFieldReady[\s\S]*fieldReady/,
  );
  assert.match(
    tournamentPage,
    /betaCampaign\?\.provisionalFieldReadyAt \|\| betaCampaign\?\.fieldFrozenAt/,
  );
});

test("the public Rocket field uses a balanced read-only preview before official staging", () => {
  assert.match(
    tournamentPage,
    /rocketRankedPreviewCount >= ROCKET_MIN_RANKED_PLAYERS/,
  );
  assert.match(
    tournamentPage,
    /assignRocketFieldTiers\([\s\S]*tournament\.players\.map/,
  );
  assert.match(
    tournamentPage,
    /rocketPreviewTierByTournamentPlayerId\.get\(tp\.id\)/,
  );
  assert.match(tournamentPage, /Balanced provisional preview\./);
  assert.match(tournamentPage, /Player names and tiers may change/);
  assert.match(
    tournamentPage,
    /Drafting stays locked until the post-deadline field passes verification/,
  );
  assert.match(
    tournamentPage,
    /Provisional preview · 10 \/ 10 \/ 10 \/ 20 \/ rest/,
  );
});

test("Rocket withdrawals notify before the lock and use deterministic reserves at lock", () => {
  assert.match(autoSub, /waitForUserAmendment/);
  assert.match(autoSub, /notifyPendingRocketSub/);
  assert.match(autoSub, /type: "team_change_required"/);
  assert.match(autoSub, /chooseNearestRankReserve/);
  assert.match(autoSub, /entryClosesAt/);
});
