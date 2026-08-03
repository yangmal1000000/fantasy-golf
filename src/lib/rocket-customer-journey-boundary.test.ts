import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const teamPage = readFileSync(
  new URL(
    "../app/tournaments/[id]/teams/[teamId]/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const teamEntry = readFileSync(
  new URL("../app/tournaments/[id]/enter/TeamEntryForm.tsx", import.meta.url),
  "utf8",
);

test("the completed homepage is driven by a verified sealed result", () => {
  const verification = home.indexOf("verifyRocketFinalResult");
  const recap = home.indexOf("buildRocketFinalRecap");
  assert.ok(verification >= 0 && recap > verification);
  assert.match(home, /Final test result · sealed/);
  assert.match(home, /The first test flight/);
  assert.match(home, /See the final leaderboard/);
  assert.match(home, /Final result verification unavailable/);
});

test("personal recap appears only for the team owner and uses sealed data", () => {
  assert.match(teamPage, /const isTeamOwner = user\?\.id === team\.userId/);
  assert.match(
    teamPage,
    /finalVerification\?\.ok && isTeamOwner[\s\S]*buildRocketFinalRecap/,
  );
  assert.match(teamPage, /Your final recap/);
  assert.match(teamPage, /See the sealed leaderboard/);
});

test("mobile team entry names the exact next requirement", () => {
  assert.match(teamEntry, /teamEntryProgress\(/);
  assert.match(teamEntry, /entryProgress\.guidance/);
  assert.match(teamEntry, /entryProgress\.mobileAction/);
  assert.match(teamEntry, /5 of 5 selected · name needed/);
  assert.match(teamEntry, /5 of 5 selected · ready to review/);
});
