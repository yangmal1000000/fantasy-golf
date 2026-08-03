export interface TeamEntryProgress {
  readyToReview: boolean;
  guidance: string;
  mobileAction: string;
}

export function teamEntryProgress(input: {
  selectedCount: number;
  hasTeamName: boolean;
  reviewLabel: string;
}): TeamEntryProgress {
  const remaining = Math.max(0, 5 - input.selectedCount);
  if (remaining > 0) {
    return {
      readyToReview: false,
      guidance: `Choose ${remaining} more golfer${remaining === 1 ? "" : "s"}`,
      mobileAction: `Pick ${remaining} more`,
    };
  }
  if (!input.hasTeamName) {
    return {
      readyToReview: false,
      guidance: "Add a team name to continue",
      mobileAction: "Add team name",
    };
  }
  return {
    readyToReview: true,
    guidance: "Ready to review and save",
    mobileAction: input.reviewLabel,
  };
}
