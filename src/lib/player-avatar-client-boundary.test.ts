import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const playerAvatar = readFileSync(
  new URL("../components/PlayerAvatar.tsx", import.meta.url),
  "utf8",
);

test("photo failure handling stays inside a client boundary", () => {
  assert.match(playerAvatar, /^"use client";/);
  assert.match(playerAvatar, /const \[imageFailed, setImageFailed\] = useState\(false\)/);
  assert.match(playerAvatar, /photoUrl && !imageFailed/);
  assert.match(playerAvatar, /onError=\{\(\) => setImageFailed\(true\)\}/);
  assert.match(playerAvatar, /return <InitialsAvatar/);
});
