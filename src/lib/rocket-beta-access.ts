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
  entryOpensAt: Date | string | null;
  fieldFrozenAt: Date | string | null;
  fieldHash: string | null;
  now?: Date;
}) {
  if (!input.fieldFrozenAt || !input.fieldHash) return false;

  const frozenAt =
    input.fieldFrozenAt instanceof Date
      ? input.fieldFrozenAt
      : new Date(input.fieldFrozenAt);
  if (Number.isNaN(frozenAt.getTime())) return false;
  if (!input.entryOpensAt) return true;

  const opensAt =
    input.entryOpensAt instanceof Date
      ? input.entryOpensAt
      : new Date(input.entryOpensAt);
  if (Number.isNaN(opensAt.getTime())) return false;
  return (input.now ?? new Date()).getTime() >= opensAt.getTime();
}
