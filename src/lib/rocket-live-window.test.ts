import assert from "node:assert/strict";
import test from "node:test";
import {
  ROCKET_LIVE_SYNC_START,
  ROCKET_LIVE_SYNC_STOP,
  isRocketLiveSyncWindow,
} from "./rocket-live-window";

test("live scoring opens at the configured start instant", () => {
  assert.equal(
    isRocketLiveSyncWindow(new Date(ROCKET_LIVE_SYNC_START.getTime() - 1)),
    false,
  );
  assert.equal(isRocketLiveSyncWindow(ROCKET_LIVE_SYNC_START), true);
});

test("live scoring remains enabled during the Rocket Classic", () => {
  assert.equal(
    isRocketLiveSyncWindow(new Date("2026-08-02T18:00:00.000Z")),
    true,
  );
});

test("live scoring closes at the configured stop instant", () => {
  assert.equal(
    isRocketLiveSyncWindow(new Date(ROCKET_LIVE_SYNC_STOP.getTime() - 1)),
    true,
  );
  assert.equal(isRocketLiveSyncWindow(ROCKET_LIVE_SYNC_STOP), false);
});
