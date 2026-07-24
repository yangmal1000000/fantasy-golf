// This is the public expected-availability point, not a security gate.
// Entry opens earlier if the complete official field is verified and frozen.
export const ROCKET_BETA_FIELD_EXPECTED_AT = new Date("2026-07-27T21:00:00.000Z");

// Keep the existing database/API field compatible while its meaning changes
// from a hard opening time to the public expected-availability time.
export const ROCKET_BETA_ENTRY_OPENS_AT = ROCKET_BETA_FIELD_EXPECTED_AT;

export const ROCKET_BETA_ENTRY_CLOSES_AT = new Date("2026-07-30T10:45:00.000Z");

// Keep public copy tied to the event rather than presenting the safety cutoff
// as official before the published tee sheet has been checked.
export const ROCKET_BETA_ENTRY_DEADLINE_CONFIRMED = false;

export function formatRocketBetaEntryDeadline(input: {
  closesAt: Date | string;
  confirmed: boolean;
  timeZone?: string;
}): string {
  if (!input.confirmed) return "At first tee";

  const closesAt =
    input.closesAt instanceof Date ? input.closesAt : new Date(input.closesAt);
  if (Number.isNaN(closesAt.getTime())) return "At first tee";

  return closesAt.toLocaleString("en-GB", {
    timeZone: input.timeZone ?? "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
