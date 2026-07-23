export const ROCKET_LIVE_SYNC_START = new Date("2026-07-30T10:00:00.000Z");
export const ROCKET_LIVE_SYNC_STOP = new Date("2026-08-03T02:00:00.000Z");

export function isRocketLiveSyncWindow(now = new Date()) {
  const timestamp = now.getTime();
  return (
    timestamp >= ROCKET_LIVE_SYNC_START.getTime() &&
    timestamp < ROCKET_LIVE_SYNC_STOP.getTime()
  );
}
