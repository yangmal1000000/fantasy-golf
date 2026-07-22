import assert from "node:assert/strict";
import test from "node:test";
import { isTargetPreviewAllowed } from "./target-preview-access";

test("allows only the approved preview account", () => {
  assert.equal(isTargetPreviewAllowed("yangmal1000000@gmail.com"), true);
  assert.equal(isTargetPreviewAllowed("  YANGMAL1000000@gmail.com "), true);
  assert.equal(isTargetPreviewAllowed("another@example.com"), false);
  assert.equal(isTargetPreviewAllowed(null), false);
  assert.equal(isTargetPreviewAllowed(undefined), false);
});
