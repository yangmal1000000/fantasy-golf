import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

type FieldManifest = {
  campaign: string;
  tournamentId: string;
  version: string;
  status: "PROVISIONAL" | "FINAL";
  publishedAt: string;
  retrievedAt: string;
  source: { publisher: string; url: string; description: string };
  freezeAllowed: boolean;
  players: string[];
};

type Ranking = { rank: number; name: string; country: string | null };

const manifestPath = path.join(
  process.cwd(),
  "data",
  "rocket-classic-2026-field.provisional.json",
);
const apply = process.argv.includes("--apply");
const freeze = process.argv.includes("--freeze");

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as FieldManifest;
  validateManifest(manifest);
  if (freeze && !manifest.freezeAllowed) {
    throw new Error(
      `Field ${manifest.version} is provisional and cannot be frozen. Replace it with the final post-qualifier manifest first.`,
    );
  }

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
        select: { id: true, playerId: true },
      }),
      prisma.team.count({ where: { tournamentId: manifest.tournamentId } }),
    ]);

  if (!tournament) throw new Error(`Tournament ${manifest.tournamentId} does not exist`);
  if (!campaign) throw new Error(`Campaign ${manifest.campaign} is not bootstrapped`);
  if (campaign.fieldFrozenAt) {
    throw new Error(`Field was frozen at ${campaign.fieldFrozenAt.toISOString()}`);
  }
  if (teamCount > 0) {
    throw new Error("Field staging is blocked after a Rocket beta team exists");
  }

  const rankingByName = new Map(rankings.map((entry) => [normaliseName(entry.name), entry]));
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
  const snapshotHash = sha256({
    campaign: manifest.campaign,
    tournamentId: manifest.tournamentId,
    version: manifest.version,
    source: manifest.source,
    players: staged.map(({ name, rank, tier }) => ({ name, rank, tier })),
  });

  const report = {
    mode: freeze ? "freeze" : apply ? "apply" : "dry-run",
    version: manifest.version,
    sourceStatus: manifest.status,
    playerCount: staged.length,
    rankingCoverage: staged.filter((player) => player.rank !== null).length,
    existingPlayerMatches: staged.filter((player) => player.existing).length,
    playersToCreate: staged.filter((player) => !player.existing).length,
    existingTournamentPlayers: existingField.length,
    tierCounts,
    snapshotHash,
  };
  console.log(JSON.stringify(report, null, 2));

  if (!apply && !freeze) return;

  await prisma.$transaction(
    async (tx) => {
      const retainedTournamentPlayerIds: string[] = [];

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
            source: manifest.source,
          } as Prisma.InputJsonValue,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 },
  );

  console.log(
    JSON.stringify(
      {
        applied: true,
        frozen: freeze,
        message: freeze
          ? "Final field and tiers are frozen."
          : "Provisional field staged; team entry remains closed until a final freeze.",
      },
      null,
      2,
    ),
  );
}

function validateManifest(manifest: FieldManifest) {
  if (
    manifest.campaign !== "rocket-classic-2026-beta" ||
    manifest.tournamentId !== "rocket-classic"
  ) {
    throw new Error("Manifest targets an unexpected campaign or tournament");
  }
  if (!Array.isArray(manifest.players) || manifest.players.length < 100) {
    throw new Error("Manifest does not contain a plausible full PGA Tour field");
  }
  const normalised = manifest.players.map(normaliseName);
  if (new Set(normalised).size !== normalised.length) {
    throw new Error("Manifest contains duplicate player names");
  }
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
    throw new Error(`ESPN rankings returned ${response.status}`);
  }
  const html = await response.text();
  const table = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table) throw new Error("ESPN rankings table was not found");

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
    throw new Error(`Only ${rankings.length} ESPN ranking rows were parsed`);
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

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
