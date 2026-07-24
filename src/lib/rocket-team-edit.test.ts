import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const updateRouteSource = readFileSync(
  new URL(
    "../app/api/tournaments/[id]/teams/[teamId]/route.ts",
    import.meta.url,
  ),
  "utf8",
);
const editPageSource = readFileSync(
  new URL(
    "../app/tournaments/[id]/teams/[teamId]/edit/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const entryFormSource = readFileSync(
  new URL("../app/tournaments/[id]/enter/TeamEntryForm.tsx", import.meta.url),
  "utf8",
);
const teamPageSource = readFileSync(
  new URL("../app/tournaments/[id]/teams/[teamId]/page.tsx", import.meta.url),
  "utf8",
);

test("Rocket team updates require the owner, linked pass, frozen field and pre-lock window", () => {
  assert.match(updateRouteSource, /userId: user\.id/);
  assert.match(updateRouteSource, /pass\.status !== "REDEEMED"/);
  assert.match(updateRouteSource, /pass\.teamId !== team\.id/);
  assert.match(
    updateRouteSource,
    /!campaign\.fieldFrozenAt \|\| !campaign\.fieldHash/,
  );
  assert.match(updateRouteSource, /new Date\(\) >= campaign\.entryClosesAt/);
  assert.match(
    updateRouteSource,
    /validateTeamEntryPlayers\(players, selections\)/,
  );
});

test("Rocket team updates rebalance selection counts and leave an audit record", () => {
  assert.match(updateRouteSource, /selectionCount: \{ decrement: 1 \}/);
  assert.match(updateRouteSource, /selectionCount: \{ increment: 1 \}/);
  assert.match(updateRouteSource, /rocket_team_updated_before_lock/);
  assert.match(
    updateRouteSource,
    /Prisma\.TransactionIsolationLevel\.Serializable/,
  );
});

test("confirmed beta teams use the same five-player review before create or edit", () => {
  assert.match(
    entryFormSource,
    /if \(dryRunMode \|\| betaMode \|\| provisionalDraftMode\)/,
  );
  assert.match(entryFormSource, /Review your Rocket team/);
  assert.match(entryFormSource, /Review team changes/);
  assert.match(
    entryFormSource,
    /method: provisionalDraftMode \? "POST" : initialTeam \? "PUT" : "POST"/,
  );
});

test("the owner can reach a prefilled edit page only before first tee", () => {
  assert.match(editPageSource, /initialTeam=\{\{/);
  assert.match(editPageSource, /betaState\.passState !== "REDEEMED"/);
  assert.match(
    editPageSource,
    /new Date\(\) < new Date\(betaState\.entryClosesAt\)/,
  );
  assert.match(teamPageSource, /Edit team before first tee/);
});
