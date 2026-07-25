import assert from "node:assert/strict";
import test from "node:test";
import { isAuthorizedOpsHeartbeat } from "./ops-heartbeat-auth";

const secret = "x".repeat(48);

test("operations heartbeat requires an exact strong bearer secret", () => {
  assert.equal(isAuthorizedOpsHeartbeat(`Bearer ${secret}`, secret), true);
  assert.equal(isAuthorizedOpsHeartbeat(`Bearer ${secret}x`, secret), false);
  assert.equal(isAuthorizedOpsHeartbeat("Bearer wrong", secret), false);
  assert.equal(isAuthorizedOpsHeartbeat(null, secret), false);
  assert.equal(isAuthorizedOpsHeartbeat(`Bearer ${secret}`, "short"), false);
});
