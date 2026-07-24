export function isRocketBetaRegistrationOpen(input: {
  status: string;
  entryClosesAt: Date | string | null;
  now?: Date;
}) {
  if (input.status !== "OPEN") return false;
  if (!input.entryClosesAt) return true;
  const closesAt =
    input.entryClosesAt instanceof Date
      ? input.entryClosesAt
      : new Date(input.entryClosesAt);
  if (Number.isNaN(closesAt.getTime())) return false;
  return (input.now ?? new Date()).getTime() < closesAt.getTime();
}

export function isRocketBetaFieldOpen(input: {
  fieldFrozenAt: Date | string | null;
  fieldHash: string | null;
}) {
  if (!input.fieldFrozenAt || !input.fieldHash) return false;

  const frozenAt =
    input.fieldFrozenAt instanceof Date
      ? input.fieldFrozenAt
      : new Date(input.fieldFrozenAt);
  if (Number.isNaN(frozenAt.getTime())) return false;
  return true;
}
