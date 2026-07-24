import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const uiSource = readFileSync(new URL("./ui.ts", import.meta.url), "utf8");
const homeSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const eventSource = readFileSync(
  new URL("../app/tournaments/[id]/page.tsx", import.meta.url),
  "utf8",
);
const listSource = readFileSync(
  new URL("../app/tournaments/page.tsx", import.meta.url),
  "utf8",
);
const artworkPath = new URL(
  "../../public/courses/detroit-gc.jpg",
  import.meta.url,
);

test("Rocket uses the dedicated Detroit artwork everywhere it is promoted", () => {
  assert.equal(existsSync(artworkPath), true);
  assert.match(uiSource, /"rocket-classic": "\/courses\/detroit-gc\.jpg"/);
  assert.match(
    uiSource,
    /keywords: \["detroit", "rocket mortgage", "rocket classic"\], image: "\/courses\/detroit-gc\.jpg"/,
  );
  assert.match(homeSource, /src="\/courses\/detroit-gc\.jpg"/);
  assert.match(eventSource, /src="\/courses\/detroit-gc\.jpg"/);
});

test("the Rocket share card and tournament listing use test-flight language", () => {
  assert.match(eventSource, /Rocket Classic Free Test Flight/);
  assert.match(eventSource, /images: \["\/courses\/detroit-gc\.jpg"\]/);
  assert.match(listSource, /Open test flight/);
  assert.match(listSource, /Free test flight/);
  assert.doesNotMatch(homeSource, /landing centre/);
});
