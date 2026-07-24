import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
export const ROCKET_REQUIRED_TIERS = [
  "T1_10",
  "T11_20",
  "T21_30",
  "T31_50",
  "T51_PLUS",
];

export class RocketFieldError extends Error {
  constructor(message: string, public readonly status = 409) {
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

  const [rankings, tournament, campaign, currentPlayers, existingField, teamCount] =
    await Promise.all([
      fetchESPNRankings(),
      prisma.tournament.findUnique({ where: { id: manifest.tournamentId } }),
      prisma.rocketBetaCampaign.findUnique({ where: { slug: manifest.campaign } }),
      prisma.player.findMany({
        select: { id: true, name: true, country: true, dataGolfRank: true },
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
  const staged = manifest.players.map((name) => {
    const ranking = rankingByName.get(normaliseName(name)) ?? null;
    const existing = playerByName.get(normaliseName(name)) ?? null;
    return {
      name,
      existing,
      rank: ranking?.rank ?? null,
      country: ranking?.country ?? existing?.country ?? null,
      tier: tierForRank(ranking?.rank ?? null),
    };
  });
  const tierCounts = staged.reduce<Record<string, number>>((counts, player) => {
    counts[player.tier] = (counts[player.tier] ?? 0) + 1;
    return counts;
  }, {});
  if (freeze) validateFrozenTiers(tierCounts);

  const sources = evidenceSources(manifest);
  const snapshotHash = sha256({
    campaign: manifest.campaign,
    tournamentId: manifest.tournamentId,
    version: manifest.version,
    officialFieldId: manifest.officialFieldId ?? null,
    sources,
    qualifiers: manifest.qualifiers ?? [],
    players: staged.map(({ name, rank, tier }) => ({ name, rank, tier })),
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
  const report = {
    ok: true,
    mode,
    version: manifest.version,
    sourceStatus: manifest.status,
    playerCount: staged.length,
    qualifierCount: manifest.qualifiers?.length ?? 0,
    evidenceSourceCount: sources.length,
    rankingCoverage: staged.filter((player) => player.rank !== null).length,
    existingPlayerMatches: staged.filter((player) => player.existing).length,
    playersToCreate: staged.filter((player) => !player.existing).length,
    existingTournamentPlayers: existingField.length,
    tierCounts,
    snapshotHash,
    preFreezeSnapshotHash,
    applied: false,
    frozen: false,
  };

  if (!apply && !freeze) return report;

  await prisma.$transaction(
    async (tx) => {
      const retainedTournamentPlayerIds: string[] = [];

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
        const player = candidate.existing
          ? await tx.player.update({
              where: { id: candidate.existing.id },
              data: {
                dataGolfRank: candidate.rank,
                country: candidate.country,
                tour: "pga",
              },
            })
          : await tx.player.create({
              data: {
                name: candidate.name,
                country: candidate.country,
                dataGolfRank: candidate.rank,
                tour: "pga",
              },
            });
        const tournamentPlayer = await tx.tournamentPlayer.upsert({
          where: {
            tournamentId_playerId: {
              tournamentId: manifest.tournamentId,
              playerId: player.id,
            },
          },
          update: { tier: candidate.tier, withdrew: false },
          create: {
            tournamentId: manifest.tournamentId,
            playerId: player.id,
            tier: candidate.tier,
          },
        });
        retainedTournamentPlayerIds.push(tournamentPlayer.id);
      }

      await tx.tournamentPlayer.deleteMany({
        where: {
          tournamentId: manifest.tournamentId,
          id: { notIn: retainedTournamentPlayerIds },
        },
      });
      await tx.rocketBetaCampaign.update({
        where: { id: campaign.id },
        data: {
          fieldVersion: manifest.version,
          fieldHash: snapshotHash,
          fieldFrozenAt: freeze ? new Date() : null,
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
      timeout: 60_000,
    },
  );

  return {
    ...report,
    applied: true,
    frozen: freeze,
    message: freeze
      ? "Final field and tiers are frozen."
      : "Provisional field staged; team entry remains closed until a final freeze.",
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
    throw new RocketFieldError("Final field contains duplicate qualifier names");
  }
  const playerNames = new Set(normalised);
  if (qualifierNames.some((name) => !playerNames.has(name))) {
    throw new RocketFieldError(
      "Every Monday qualifier must appear in the final field",
    );
  }
}

function validateFrozenTiers(tierCounts: Record<string, number>) {
  const missing = ROCKET_REQUIRED_TIERS.filter((tier) => !tierCounts[tier]);
  if (missing.length > 0) {
    throw new RocketFieldError(`Final field has empty tiers: ${missing.join(", ")}`);
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

function tierForRank(rank: number | null) {
  if (rank === null || rank > 50) return "T51_PLUS";
  if (rank <= 10) return "T1_10";
  if (rank <= 20) return "T11_20";
  if (rank <= 30) return "T21_30";
  return "T31_50";
}

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
