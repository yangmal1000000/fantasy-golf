import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { genId } from "@/lib/db-ensure";
import {
  parseRocketDraft,
  reconcileRocketDraft,
  type RocketReserveCandidate,
} from "@/lib/rocket-draft";
import {
  assignRocketFieldTiers,
  ROCKET_FIELD_TIER_ORDER,
  ROCKET_FIELD_TIER_TARGET_COUNTS,
  ROCKET_MIN_RANKED_PLAYERS,
} from "@/lib/rocket-tiers";
import { sendPushToUser } from "@/lib/push";

export type FieldEvidence = {
  publisher: string;
  url: string;
  description: string;
  role?: "FIELD_AUTHORITY" | "QUALIFIER_RESULTS" | "CORROBORATION";
};

export type FieldManifest = {
  campaign: string;
  tournamentId: string;
  version: string;
  status: "PROVISIONAL" | "FINAL";
  publishedAt: string;
  retrievedAt: string;
  source?: FieldEvidence;
  sources?: FieldEvidence[];
  officialFieldId?: string;
  qualifiers?: string[];
  freezeAllowed: boolean;
  players: string[];
};

type Ranking = { rank: number; name: string; country: string | null };

export const ROCKET_OFFICIAL_FIELD_ID = "R2026524";
export const ROCKET_COMMITMENT_DEADLINE = "2026-07-24T21:00:00.000Z";
export const ROCKET_REQUIRED_TIERS = [...ROCKET_FIELD_TIER_ORDER];

export class RocketFieldError extends Error {
  constructor(
    message: string,
    public readonly status = 409,
  ) {
    super(message);
  }
}

export async function stageRocketBetaField(
  manifest: FieldManifest,
  mode: "dry-run" | "apply" | "freeze",
) {
  const freeze = mode === "freeze";
  const apply = mode === "apply";
  validateManifest(manifest, freeze);
  if (apply) validateOfficialInitialManifest(manifest);
  const [
    rankings,
    tournament,
    campaign,
    currentPlayers,
    existingField,
    teamCount,
  ] = await Promise.all([
    fetchESPNRankings(),
    prisma.tournament.findUnique({ where: { id: manifest.tournamentId } }),
    prisma.rocketBetaCampaign.findUnique({
      where: { slug: manifest.campaign },
    }),
    prisma.player.findMany({
      select: {
        id: true,
        name: true,
        country: true,
        dataGolfRank: true,
        tour: true,
      },
    }),
    prisma.tournamentPlayer.findMany({
      where: { tournamentId: manifest.tournamentId },
      select: {
        id: true,
        playerId: true,
        tier: true,
        madeCut: true,
        withdrew: true,
        player: {
          select: {
            name: true,
            country: true,
            dataGolfRank: true,
          },
        },
      },
    }),
    prisma.team.count({ where: { tournamentId: manifest.tournamentId } }),
  ]);

  if (!tournament) {
    throw new RocketFieldError(
      `Tournament ${manifest.tournamentId} does not exist`,
      404,
    );
  }
  if (!campaign) {
    throw new RocketFieldError(
      `Campaign ${manifest.campaign} is not bootstrapped`,
      404,
    );
  }
  if (campaign.fieldFrozenAt) {
    throw new RocketFieldError(
      `Field was frozen at ${campaign.fieldFrozenAt.toISOString()}`,
    );
  }
  if (teamCount > 0) {
    throw new RocketFieldError(
      "Field staging is blocked after a Rocket beta team exists",
    );
  }

  const rankingByName = new Map(
    rankings.map((entry) => [normaliseName(entry.name), entry]),
  );
  const playerByName = new Map(
    currentPlayers.map((player) => [normaliseName(player.name), player]),
  );
  const staged = assignRocketFieldTiers(
    manifest.players.map((name) => {
      const ranking = rankingByName.get(normaliseName(name)) ?? null;
      const existing = playerByName.get(normaliseName(name)) ?? null;
      return {
        name,
        existing,
        rank: ranking?.rank ?? null,
        country: ranking?.country ?? existing?.country ?? null,
      };
    }),
  );
  const tierCounts = staged.reduce<Record<string, number>>((counts, player) => {
    counts[player.tier] = (counts[player.tier] ?? 0) + 1;
    return counts;
  }, {});
  const rankingCoverage = staged.filter((player) => player.rank !== null).length;
  if (apply || freeze) {
    validateRocketFieldTiers(tierCounts, rankingCoverage, staged.length);
  }

  const sources = evidenceSources(manifest);
  const snapshotHash = sha256({
    campaign: manifest.campaign,
    tournamentId: manifest.tournamentId,
    version: manifest.version,
    officialFieldId: manifest.officialFieldId ?? null,
    sources,
    qualifiers: manifest.qualifiers ?? [],
    tierPolicy: "field-relative-10-10-10-20-rest",
    players: staged.map(({ name, rank, tier, fieldPosition }) => ({
      name,
      rank,
      fieldPosition,
      tier,
    })),
  });
  const preFreezeSnapshot = freeze
    ? {
        campaignId: campaign.id,
        fieldVersion: campaign.fieldVersion,
        fieldHash: campaign.fieldHash,
        fieldFrozenAt: null,
        players: existingField.map((entry) => ({
          playerId: entry.playerId,
          name: entry.player.name,
          country: entry.player.country,
          rank: entry.player.dataGolfRank,
          tier: entry.tier,
          madeCut: entry.madeCut,
          withdrew: entry.withdrew,
        })),
      }
    : null;
  const preFreezeSnapshotHash = preFreezeSnapshot
    ? sha256(preFreezeSnapshot)
    : null;
  const existingFieldByName = new Map(
    existingField.map((entry) => [normaliseName(entry.player.name), entry]),
  );
  const fieldMatchesStaged =
    existingField.length === staged.length &&
    staged.every((candidate) => {
      const current = existingFieldByName.get(normaliseName(candidate.name));
      return current?.tier === candidate.tier && current.withdrew === false;
    });
  const campaignMatchesStaged =
    campaign.fieldVersion === manifest.version &&
    campaign.fieldHash === snapshotHash &&
    campaign.provisionalFieldReadyAt !== null;
  const report = {
    ok: true,
    mode,
    version: manifest.version,
    sourceStatus: manifest.status,
    playerCount: staged.length,
    qualifierCount: manifest.qualifiers?.length ?? 0,
    evidenceSourceCount: sources.length,
    rankingCoverage,
    minimumRankingCoverage: ROCKET_MIN_RANKED_PLAYERS,
    tierPolicy: "field-relative-10-10-10-20-rest",
    existingPlayerMatches: staged.filter((player) => player.existing).length,
    playersToCreate: staged.filter((player) => !player.existing).length,
    existingTournamentPlayers: existingField.length,
    fieldMatchesStaged,
    tierCounts,
    snapshotHash,
    preFreezeSnapshotHash,
    alreadyApplied: false,
    applied: false,
    frozen: false,
    provisionalDraftingOpened: false,
    draftsReconciled: 0,
    draftChanges: 0,
    teamsAutoConfirmed: 0,
    teamsAutoConfirmedWithChanges: 0,
  };

  if (!apply && !freeze) return report;
  if (apply && campaignMatchesStaged) {
    if (!fieldMatchesStaged) {
      throw new RocketFieldError(
        "Campaign records the staged field but the live roster does not match",
      );
    }
    return {
      ...report,
      alreadyApplied: true,
      applied: true,
      provisionalDraftingOpened: true,
      message:
        "Official initial field was already staged; provisional drafting is open.",
    };
  }

  const draftNotifications: {
    userId: string;
    title: string;
    body: string;
  }[] = [];
  let draftsReconciled = 0;
  let draftChanges = 0;
  let teamsAutoConfirmed = 0;
  let teamsAutoConfirmedWithChanges = 0;
  const changedAt = new Date();

  await prisma.$transaction(
    async (tx) => {
      const finalRoster: RocketReserveCandidate[] = [];
      const playerByNormalisedName = new Map(
        currentPlayers.map((player) => [normaliseName(player.name), player]),
      );

      if (freeze && preFreezeSnapshot && preFreezeSnapshotHash) {
        await tx.rocketBetaAudit.create({
          data: {
            campaignId: campaign.id,
            action: "field_pre_freeze_snapshot",
            payload: {
              ...preFreezeSnapshot,
              snapshotHash: preFreezeSnapshotHash,
            } as Prisma.InputJsonValue,
          },
        });
      }

      for (const candidate of staged) {
        let player = playerByNormalisedName.get(
          normaliseName(candidate.name),
        );
        if (!player) {
          player = await tx.player.create({
            data: {
              name: candidate.name,
              country: candidate.country,
              dataGolfRank: candidate.rank,
              tour: "pga",
            },
          });
          playerByNormalisedName.set(normaliseName(candidate.name), player);
        } else if (
          player.dataGolfRank !== candidate.rank ||
          player.country !== candidate.country ||
          player.tour !== "pga"
        ) {
          player = await tx.player.update({
            where: { id: player.id },
            data: {
              dataGolfRank: candidate.rank,
              country: candidate.country,
              tour: "pga",
            },
          });
          playerByNormalisedName.set(normaliseName(candidate.name), player);
        }
        finalRoster.push({
          tier: candidate.tier,
          playerId: player.id,
          playerName: candidate.name,
          rank: candidate.rank,
        });
      }

      const retainedPlayerIds = finalRoster.map((player) => player.playerId);
      const existingTournamentPlayerIds = new Set(
        existingField.map((player) => player.playerId),
      );
      const newTournamentPlayers = finalRoster.filter(
        (player) => !existingTournamentPlayerIds.has(player.playerId),
      );
      if (newTournamentPlayers.length > 0) {
        await tx.tournamentPlayer.createMany({
          data: newTournamentPlayers.map((player) => ({
            tournamentId: manifest.tournamentId,
            playerId: player.playerId,
            tier: player.tier,
          })),
          skipDuplicates: true,
        });
      }
      for (const tier of ROCKET_REQUIRED_TIERS) {
        const playerIds = finalRoster
          .filter((player) => player.tier === tier)
          .map((player) => player.playerId);
        await tx.tournamentPlayer.updateMany({
          where: {
            tournamentId: manifest.tournamentId,
            playerId: { in: playerIds },
          },
          data: { tier, withdrew: false },
        });
      }
      await tx.tournamentPlayer.deleteMany({
        where: {
          tournamentId: manifest.tournamentId,
          playerId: { notIn: retainedPlayerIds },
        },
      });

      if (freeze) {
        const reconciliation = await reconcileDraftsForFinalField(tx, {
          campaignId: campaign.id,
          tournamentId: manifest.tournamentId,
          fieldVersion: manifest.version,
          fieldHash: snapshotHash,
          reconciledAt: changedAt,
          finalRoster,
        });
        draftsReconciled = reconciliation.draftsReconciled;
        draftChanges = reconciliation.draftChanges;
        teamsAutoConfirmed = reconciliation.teamsAutoConfirmed;
        teamsAutoConfirmedWithChanges =
          reconciliation.teamsAutoConfirmedWithChanges;
        draftNotifications.push(...reconciliation.notifications);
      }

      await tx.rocketBetaCampaign.update({
        where: { id: campaign.id },
        data: {
          fieldVersion: manifest.version,
          fieldHash: snapshotHash,
          fieldFrozenAt: freeze ? changedAt : null,
          provisionalFieldReadyAt:
            apply || freeze
              ? (campaign.provisionalFieldReadyAt ?? changedAt)
              : campaign.provisionalFieldReadyAt,
        },
      });
      await tx.rocketBetaAudit.create({
        data: {
          campaignId: campaign.id,
          action: freeze ? "field_frozen" : "field_staged",
          payload: {
            version: manifest.version,
            status: manifest.status,
            playerCount: staged.length,
            rankingCoverage: report.rankingCoverage,
            tierCounts,
            snapshotHash,
            officialFieldId: manifest.officialFieldId ?? null,
            qualifiers: manifest.qualifiers ?? [],
            sources,
          } as Prisma.InputJsonValue,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 90_000,
    },
  );

  await Promise.allSettled(
    draftNotifications.map((notification) =>
      sendPushToUser(notification.userId, {
        title: notification.title,
        body: notification.body,
        url: "/my-teams",
        tag: "rocket-draft-field-change",
      }),
    ),
  );

  return {
    ...report,
    applied: true,
    frozen: freeze,
    provisionalDraftingOpened: apply,
    draftsReconciled,
    draftChanges,
    teamsAutoConfirmed,
    teamsAutoConfirmedWithChanges,
    message: freeze
      ? "Final field and tiers are frozen; saved drafts were confirmed automatically."
      : "Official initial field staged; provisional drafting is open and the Test Pass remains unlocked.",
  };
}

export function validateManifest(
  manifest: FieldManifest,
  freezeRequested: boolean,
) {
  if (
    manifest.campaign !== "rocket-classic-2026-beta" ||
    manifest.tournamentId !== "rocket-classic"
  ) {
    throw new RocketFieldError(
      "Manifest targets an unexpected campaign or tournament",
    );
  }
  if (
    !Array.isArray(manifest.players) ||
    manifest.players.length < 120 ||
    manifest.players.length > 170
  ) {
    throw new RocketFieldError(
      "Manifest does not contain a plausible full PGA Tour field",
    );
  }
  if (
    manifest.players.some(
      (name) => typeof name !== "string" || normaliseName(name).length < 2,
    )
  ) {
    throw new RocketFieldError("Manifest contains an invalid player name");
  }
  if (
    manifest.players.some((name) =>
      /(?:^|\b)(?:tbd|open qualifier|monday qualifier|qualifier spot)(?:\b|$)/i.test(
        name,
      ),
    )
  ) {
    throw new RocketFieldError("Manifest contains a placeholder player");
  }
  const normalised = manifest.players.map(normaliseName);
  if (new Set(normalised).size !== normalised.length) {
    throw new RocketFieldError("Manifest contains duplicate player names");
  }
  if (
    Number.isNaN(Date.parse(manifest.publishedAt)) ||
    Number.isNaN(Date.parse(manifest.retrievedAt))
  ) {
    throw new RocketFieldError("Manifest publication timestamps are invalid");
  }

  const sources = evidenceSources(manifest);
  if (sources.length === 0) {
    throw new RocketFieldError("Manifest has no source evidence");
  }
  for (const source of sources) {
    if (
      !source.publisher?.trim() ||
      !source.description?.trim() ||
      !source.url?.startsWith("https://")
    ) {
      throw new RocketFieldError("Manifest contains invalid source evidence");
    }
  }

  if (!freezeRequested) return;
  if (manifest.status !== "FINAL" || !manifest.freezeAllowed) {
    throw new RocketFieldError(
      "Only a final freeze-approved manifest can be frozen",
    );
  }
  if (manifest.officialFieldId !== ROCKET_OFFICIAL_FIELD_ID) {
    throw new RocketFieldError(
      `Final field must use the official PGA TOUR field ${ROCKET_OFFICIAL_FIELD_ID}`,
    );
  }
  if (
    !sources.some((source) => source.role === "FIELD_AUTHORITY") ||
    !sources.some((source) => source.role === "QUALIFIER_RESULTS")
  ) {
    throw new RocketFieldError(
      "Final field needs both PGA TOUR field authority and official qualifier evidence",
    );
  }
  if (!Array.isArray(manifest.qualifiers) || manifest.qualifiers.length !== 4) {
    throw new RocketFieldError(
      "Final field must identify all four Monday qualifiers",
    );
  }
  const qualifierNames = manifest.qualifiers.map(normaliseName);
  if (new Set(qualifierNames).size !== qualifierNames.length) {
    throw new RocketFieldError(
      "Final field contains duplicate qualifier names",
    );
  }
  const playerNames = new Set(normalised);
  if (qualifierNames.some((name) => !playerNames.has(name))) {
    throw new RocketFieldError(
      "Every Monday qualifier must appear in the final field",
    );
  }
}

export function validateOfficialInitialManifest(manifest: FieldManifest) {
  const sources = evidenceSources(manifest);
  if (
    manifest.status !== "PROVISIONAL" ||
    manifest.freezeAllowed ||
    manifest.officialFieldId !== ROCKET_OFFICIAL_FIELD_ID ||
    Date.parse(manifest.retrievedAt) < Date.parse(ROCKET_COMMITMENT_DEADLINE) ||
    !sources.some((source) => source.role === "FIELD_AUTHORITY")
  ) {
    throw new RocketFieldError(
      "Provisional drafting requires the official post-deadline PGA TOUR field",
    );
  }
}

async function reconcileDraftsForFinalField(
  tx: Prisma.TransactionClient,
  input: {
    campaignId: string;
    tournamentId: string;
    fieldVersion: string;
    fieldHash: string;
    reconciledAt: Date;
    finalRoster: RocketReserveCandidate[];
  },
) {
  const passes = await tx.rocketBetaPass.findMany({
    where: {
      campaignId: input.campaignId,
      status: "UNLOCKED",
      teamId: null,
    },
  });
  const notifications: {
    userId: string;
    title: string;
    body: string;
  }[] = [];
  let draftsReconciled = 0;
  let draftChanges = 0;
  let teamsAutoConfirmed = 0;
  let teamsAutoConfirmedWithChanges = 0;
  const tournamentPlayers = await tx.tournamentPlayer.findMany({
    where: { tournamentId: input.tournamentId },
    select: {
      id: true,
      playerId: true,
      tier: true,
      withdrew: true,
    },
  });
  const tournamentPlayerByPlayerId = new Map(
    tournamentPlayers.map((player) => [player.playerId, player]),
  );

  for (const pass of passes) {
    if (!pass.draftTeam) continue;
    const draft = parseRocketDraft(pass.draftTeam);
    if (!draft) {
      throw new RocketFieldError(
        `Stored Rocket draft ${pass.id} failed integrity validation`,
      );
    }
    const reconciled = reconcileRocketDraft(draft, input.finalRoster, {
      fieldVersion: input.fieldVersion,
      fieldHash: input.fieldHash,
      reconciledAt: input.reconciledAt.toISOString(),
    });

    const selectedTournamentPlayers = reconciled.draft.picks.map((pick) => {
      const tournamentPlayer = tournamentPlayerByPlayerId.get(pick.playerId);
      if (
        !tournamentPlayer ||
        tournamentPlayer.tier !== pick.tier ||
        tournamentPlayer.withdrew
      ) {
        throw new RocketFieldError(
          `Reconciled Rocket draft ${pass.id} does not match the frozen field`,
        );
      }
      return tournamentPlayer;
    });
    if (
      selectedTournamentPlayers.length !== 5 ||
      new Set(selectedTournamentPlayers.map((player) => player.id)).size !== 5
    ) {
      throw new RocketFieldError(
        `Reconciled Rocket draft ${pass.id} is not a valid five-player team`,
      );
    }

    const team = await tx.team.create({
      data: {
        name: reconciled.draft.teamName,
        userId: pass.userId,
        tournamentId: input.tournamentId,
        selections: {
          create: selectedTournamentPlayers.map((player) => ({
            tournamentPlayerId: player.id,
          })),
        },
      },
    });
    if (reconciled.changes.length > 0) {
      await tx.teamSubLog.createMany({
        data: reconciled.changes.map((change) => ({
          teamId: team.id,
          oldPlayerId: change.oldPlayerId,
          newPlayerId: change.newPlayerId,
          tier: change.tier,
          reason: `final_field_${change.reason.toLowerCase()}_nearest_rank`,
        })),
      });
    }
    await tx.tournamentPlayer.updateMany({
      where: {
        id: { in: selectedTournamentPlayers.map((player) => player.id) },
      },
      data: { selectionCount: { increment: 1 } },
    });
    const redeemed = await tx.rocketBetaPass.updateMany({
      where: {
        id: pass.id,
        status: "UNLOCKED",
        teamId: null,
      },
      data: {
        status: "REDEEMED",
        redeemedAt: input.reconciledAt,
        teamId: team.id,
        draftTeam: Prisma.DbNull,
        draftUpdatedAt: input.reconciledAt,
        draftFieldVersion: input.fieldVersion,
      },
    });
    if (redeemed.count !== 1) {
      throw new RocketFieldError(
        `Rocket Test Pass ${pass.id} changed during final-field confirmation`,
      );
    }
    await tx.rocketBetaAudit.create({
      data: {
        campaignId: input.campaignId,
        actorUserId: pass.userId,
        action: "rocket_provisional_draft_auto_confirmed",
        payload: {
          passId: pass.id,
          teamId: team.id,
          fieldVersion: input.fieldVersion,
          fieldHash: input.fieldHash,
          changes: reconciled.changes,
          policy: "auto_confirm_final_field_nearest_rank_same_tier",
        } as unknown as Prisma.InputJsonValue,
      },
    });
    draftsReconciled += 1;
    draftChanges += reconciled.changes.length;
    teamsAutoConfirmed += 1;
    if (reconciled.changes.length > 0) {
      teamsAutoConfirmedWithChanges += 1;
    }

    const summary = reconciled.changes
      .map(
        (change) =>
          `${change.oldPlayerName} → ${change.newPlayerName} (${change.tier})`,
      )
      .join("; ");
    const title =
      reconciled.changes.length === 0
        ? "Rocket team confirmed automatically"
        : reconciled.changes.length === 1
          ? "Rocket team changed — review your pick"
          : "Rocket team changed — review your picks";
    const body =
      reconciled.changes.length === 0
        ? "Your five picks were unchanged in the verified final field, so your official team is now fixed and your Test Pass has been redeemed."
        : `${summary}. The nearest-ranked available golfer in the same tier was selected automatically. Your official team is confirmed, but you can amend it before first tee.`;
    await tx.notification.create({
      data: {
        id: genId(),
        userId: pass.userId,
        title,
        body,
        type:
          reconciled.changes.length === 0
            ? "info"
            : "team_change_required",
      },
    });
    notifications.push({ userId: pass.userId, title, body });
  }

  return {
    draftsReconciled,
    draftChanges,
    teamsAutoConfirmed,
    teamsAutoConfirmedWithChanges,
    notifications,
  };
}

function validateRocketFieldTiers(
  tierCounts: Record<string, number>,
  rankingCoverage: number,
  playerCount: number,
) {
  if (rankingCoverage < ROCKET_MIN_RANKED_PLAYERS) {
    throw new RocketFieldError(
      `Rocket field needs at least ${ROCKET_MIN_RANKED_PLAYERS} ranked golfers to build balanced tiers; matched ${rankingCoverage}`,
      502,
    );
  }
  const missing = ROCKET_REQUIRED_TIERS.filter((tier) => !tierCounts[tier]);
  if (missing.length > 0) {
    throw new RocketFieldError(
      `Final field has empty tiers: ${missing.join(", ")}`,
    );
  }
  for (const [tier, expected] of Object.entries(
    ROCKET_FIELD_TIER_TARGET_COUNTS,
  )) {
    if (tierCounts[tier] !== expected) {
      throw new RocketFieldError(
        `Rocket ${tier} must contain exactly ${expected} golfers; found ${tierCounts[tier] ?? 0}`,
      );
    }
  }
  const expectedTierFive = playerCount - ROCKET_MIN_RANKED_PLAYERS;
  if (tierCounts.T51_PLUS !== expectedTierFive) {
    throw new RocketFieldError(
      `Rocket T51_PLUS must contain the remaining ${expectedTierFive} golfers; found ${tierCounts.T51_PLUS ?? 0}`,
    );
  }
}

function evidenceSources(manifest: FieldManifest): FieldEvidence[] {
  if (Array.isArray(manifest.sources)) return manifest.sources;
  return manifest.source ? [manifest.source] : [];
}

async function fetchESPNRankings(): Promise<Ranking[]> {
  const response = await fetch("https://www.espn.com/golf/rankings", {
    headers: {
      Accept: "text/html",
      "User-Agent": "Mozilla/5.0 (compatible; FantasyGolfBetaField/1.0)",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new RocketFieldError(
      `ESPN rankings returned ${response.status}`,
      502,
    );
  }
  const html = await response.text();
  const table = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table) {
    throw new RocketFieldError("ESPN rankings table was not found", 502);
  }

  const rankings: Ranking[] = [];
  for (const row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
      (cell) => decodeText(cell[1]),
    );
    const rank = Number.parseInt(cells[0] ?? "", 10);
    const name = cells[1]?.trim();
    if (!Number.isInteger(rank) || rank < 1 || rank > 500 || !name) continue;
    const flag = row[1].match(/countries\/500\/(\w+)\.png/i)?.[1] ?? null;
    rankings.push({ rank, name, country: flag?.toUpperCase() ?? null });
  }
  if (rankings.length < 150) {
    throw new RocketFieldError(
      `Only ${rankings.length} ESPN ranking rows were parsed`,
      502,
    );
  }
  return rankings;
}

function decodeText(html: string) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .trim();
}

function normaliseName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
