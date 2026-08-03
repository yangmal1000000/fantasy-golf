import "server-only";

import { prisma } from "@/lib/prisma";
import {
  ROCKET_BETA_CAMPAIGN_SLUG,
  ROCKET_BETA_TOURNAMENT_ID,
} from "@/lib/rocket-beta";
import {
  ROCKET_LIVE_SYNC_START,
  ROCKET_LIVE_SYNC_STOP,
} from "@/lib/rocket-live-window";
import {
  OPERATIONAL_JOB_CONTRACTS,
  type OperationalJobContract,
} from "@/lib/operational-jobs";
import { calculateLeaderboard } from "@/lib/scoring";

const ROCKET_ENTRY_FUNNEL_ACTIONS = [
  "rocket_funnel_five_picks_selected",
  "rocket_funnel_review_opened",
] as const;

export type OperationsTone = "healthy" | "warning" | "critical" | "waiting";

export interface OperationsMetric {
  label: string;
  value: string;
  detail: string;
  source: string;
  href?: string;
  tone: OperationsTone;
}

export interface OperationsJobStatus {
  key: string;
  name: string;
  source: string;
  status: string;
  tone: OperationsTone;
  lastRunAt: Date | null;
  completedAt: Date | null;
  recordsProcessed: number | null;
  summary: string | null;
}

export interface OperationsCockpit {
  generatedAt: Date;
  databaseLatencyMs: number;
  region: string;
  campaign: {
    name: string;
    status: string;
    fieldStatus: string;
    fieldVersion: string | null;
    fieldHashShort: string | null;
    fieldFrozenAt: Date | null;
    fieldUpdatedAt: Date;
    entryClosesAt: Date | null;
    tournamentStatus: string;
    currentRound: number;
  } | null;
  funnel: OperationsMetric[];
  health: OperationsMetric[];
  fieldTiers: Array<{ tier: string; count: number }>;
  jobs: OperationsJobStatus[];
  incidents: Array<{
    id: string;
    title: string;
    detail: string;
    tone: Exclude<OperationsTone, "healthy">;
  }>;
  recentAudit: Array<{
    id: string;
    action: string;
    createdAt: Date;
  }>;
}

export async function readOperationsCockpit(): Promise<OperationsCockpit> {
  const generatedAt = new Date();
  const dbStartedAt = performance.now();
  const [campaign, accounts, jobs, notificationActivity, pushSubscriptions] =
    await Promise.all([
    prisma.rocketBetaCampaign.findUnique({
      where: { slug: ROCKET_BETA_CAMPAIGN_SLUG },
      select: {
        id: true,
        name: true,
        status: true,
        tournamentId: true,
        targetRoundId: true,
        entryClosesAt: true,
        fieldVersion: true,
        fieldHash: true,
        fieldFrozenAt: true,
        provisionalFieldReadyAt: true,
        updatedAt: true,
        finalizedAt: true,
        members: {
          select: {
            active: true,
            passes: {
              select: {
                status: true,
                draftUpdatedAt: true,
                redeemedAt: true,
                teamId: true,
              },
            },
          },
        },
        auditEvents: {
          where: {
            action: { notIn: [...ROCKET_ENTRY_FUNNEL_ACTIONS] },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, action: true, createdAt: true },
        },
      },
    }),
    prisma.user.count(),
    prisma.operationalJob.findMany({
      where: { enabled: true },
      orderBy: { key: "asc" },
      include: {
        runs: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.notification.aggregate({
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    readPushSubscriptionCount(),
  ]);
  const databaseLatencyMs = Math.max(1, Math.round(performance.now() - dbStartedAt));

  if (!campaign) {
    return {
      generatedAt,
      databaseLatencyMs,
      region: process.env.VERCEL_REGION ?? "local",
      campaign: null,
      funnel: [
        metric("Accounts", accounts, "Canonical User records", "PostgreSQL", "/admin/customers"),
      ],
      health: [
        healthMetric(
          "Database",
          "Connected",
          `${databaseLatencyMs} ms read`,
          "Prisma SELECT",
          databaseLatencyMs > 1_000 ? "warning" : "healthy",
        ),
      ],
      fieldTiers: [],
      jobs: mapJobs(jobs, generatedAt),
      incidents: [
        {
          id: "campaign-missing",
          title: "Rocket campaign unavailable",
          detail: "The operations cockpit could not find the configured Rocket beta campaign.",
          tone: "critical",
        },
      ],
      recentAudit: [],
    };
  }

  const [
    targetComplete,
    officialTeams,
    tournament,
    fieldGroups,
    scoreActivity,
    entryFunnelEvents,
    leaderboard,
  ] = await Promise.all([
    prisma.targetPilotEntry.count({ where: { roundId: campaign.targetRoundId } }),
    prisma.team.count({ where: { tournamentId: campaign.tournamentId } }),
    prisma.tournament.findUnique({
      where: { id: campaign.tournamentId },
      select: { status: true, currentRound: true },
    }),
    prisma.tournamentPlayer.groupBy({
      by: ["tier"],
      where: { tournamentId: campaign.tournamentId },
      _count: { _all: true },
    }),
    prisma.score.aggregate({
      where: { tournamentId: campaign.tournamentId },
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.rocketBetaAudit.findMany({
      where: {
        campaignId: campaign.id,
        action: { in: [...ROCKET_ENTRY_FUNNEL_ACTIONS] },
        actorUserId: { not: null },
      },
      select: {
        action: true,
        actorUserId: true,
      },
    }),
    calculateLeaderboard(campaign.tournamentId).catch(() => []),
  ]);

  const passes = campaign.members.flatMap((member) => member.passes);
  const activeMembers = campaign.members.filter((member) => member.active).length;
  const draftsSaved = passes.filter((pass) => pass.draftUpdatedAt).length;
  const passesUnlocked = passes.filter((pass) => pass.status !== "REVOKED").length;
  const confirmedFromPasses = passes.filter(
    (pass) => pass.teamId || pass.redeemedAt,
  ).length;
  const fivePicksReached = new Set(
    entryFunnelEvents
      .filter(
        (event) => event.action === "rocket_funnel_five_picks_selected",
      )
      .map((event) => event.actorUserId),
  ).size;
  const reviewOpened = new Set(
    entryFunnelEvents
      .filter((event) => event.action === "rocket_funnel_review_opened")
      .map((event) => event.actorUserId),
  ).size;
  const fieldCount = fieldGroups.reduce(
    (total, group) => total + group._count._all,
    0,
  );
  const fieldStatus = campaign.fieldFrozenAt
    ? "FROZEN"
    : campaign.provisionalFieldReadyAt && campaign.fieldHash
      ? "PROVISIONAL"
      : "NOT READY";
  const jobsMapped = mapJobs(jobs, generatedAt);
  const completeTeams = leaderboard.filter(
    (team) => team.scoreState === "FINAL" && team.roundsScored === 20,
  ).length;
  const incompleteTeams = leaderboard.length - completeTeams;
  const incidents = buildIncidents({
    databaseLatencyMs,
    campaignStatus: campaign.status,
    fieldStatus,
    tournamentStatus: tournament?.status ?? "missing",
    teamCount: leaderboard.length,
    incompleteTeams,
    jobs: jobsMapped,
  });

  return {
    generatedAt,
    databaseLatencyMs,
    region: process.env.VERCEL_REGION ?? "local",
    campaign: {
      name: campaign.name,
      status: campaign.status,
      fieldStatus,
      fieldVersion: campaign.fieldVersion,
      fieldHashShort: campaign.fieldHash?.slice(0, 12) ?? null,
      fieldFrozenAt: campaign.fieldFrozenAt,
      fieldUpdatedAt:
        campaign.fieldFrozenAt ??
        campaign.finalizedAt ??
        campaign.provisionalFieldReadyAt ??
        campaign.updatedAt,
      entryClosesAt: campaign.entryClosesAt,
      tournamentStatus: tournament?.status ?? "missing",
      currentRound: tournament?.currentRound ?? 0,
    },
    funnel: [
      metric("Accounts", accounts, "Canonical User records", "User", "/admin/customers"),
      metric(
        "Rocket testers",
        activeMembers,
        "Active campaign members",
        "RocketBetaMember",
        "/admin/customers?stage=rocket_joined",
      ),
      metric(
        "Target complete",
        targetComplete,
        "Locked submissions",
        "TargetPilotEntry",
        "/admin/customers?stage=target_complete",
      ),
      metric(
        "Test Passes",
        passesUnlocked,
        "Unlocked or redeemed",
        "RocketBetaPass",
        "/admin/customers?stage=test_pass",
      ),
      metric(
        "5/5 selected",
        fivePicksReached,
        "Unique users since clarity tracking began",
        "RocketBetaAudit",
      ),
      metric(
        "Review opened",
        reviewOpened,
        "Unique users since clarity tracking began",
        "RocketBetaAudit",
      ),
      metric(
        "Drafts saved",
        draftsSaved,
        "Provisional teams",
        "RocketBetaPass.draftUpdatedAt",
        "/admin/customers?stage=draft_saved",
      ),
      metric(
        "Official teams",
        Math.max(officialTeams, confirmedFromPasses),
        "Created Team rows",
        "Team + RocketBetaPass",
        "/admin/customers?stage=official_team",
      ),
    ],
    health: [
      healthMetric(
        "Database",
        "Connected",
        `${databaseLatencyMs} ms read`,
        "Prisma SELECT",
        databaseLatencyMs > 1_000 ? "warning" : "healthy",
      ),
      healthMetric(
        "Field",
        fieldStatus,
        `${fieldCount} golfers · ${campaign.fieldVersion ?? "no version"}`,
        "TournamentPlayer + RocketBetaCampaign",
        fieldStatus === "NOT READY" ? "critical" : fieldStatus === "FROZEN" ? "healthy" : "waiting",
        "/rocket-control",
      ),
      healthMetric(
        "Scoring",
        campaign.finalizedAt
          ? "FINAL"
          : tournament?.status === "in_progress"
            ? "LIVE"
            : tournament?.status === "completed"
              ? "AWAITING FINALIZATION"
              : "WAITING",
        scoreActivity._max.updatedAt
          ? `${completeTeams}/${leaderboard.length} teams complete · ${scoreActivity._count._all} score rows · updated ${formatRelative(scoreActivity._max.updatedAt, generatedAt)}`
          : "No Rocket scores yet",
        "Score + sealed Rocket result",
        campaign.finalizedAt
          ? "healthy"
          : tournament?.status === "completed" && incompleteTeams > 0
            ? "critical"
            : tournament?.status === "in_progress" && !scoreActivity._max.updatedAt
              ? "warning"
              : "waiting",
        "/rocket-control",
      ),
      healthMetric(
        "In-app notices",
        notificationActivity._count._all > 0 ? "RECORDED" : "NONE",
        notificationActivity._max.createdAt
          ? `${notificationActivity._count._all} total · latest ${formatRelative(
              notificationActivity._max.createdAt,
              generatedAt,
            )}`
          : "No recorded notifications",
        "Notification",
        "waiting",
      ),
      healthMetric(
        "Push delivery",
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
          process.env.VAPID_PRIVATE_KEY
          ? "CONFIGURED"
          : "NOT CONFIGURED",
        `${pushSubscriptions} active subscription${
          pushSubscriptions === 1 ? "" : "s"
        } · delivery attempts are recorded below`,
        "VAPID configuration + PushSubscription",
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
          process.env.VAPID_PRIVATE_KEY
          ? "waiting"
          : "warning",
      ),
      healthMetric(
        "Live runner",
        generatedAt < ROCKET_LIVE_SYNC_START
          ? "SCHEDULED"
          : generatedAt > ROCKET_LIVE_SYNC_STOP
            ? "ENDED"
            : "ACTIVE WINDOW",
        `${formatDate(ROCKET_LIVE_SYNC_START)} → ${formatDate(ROCKET_LIVE_SYNC_STOP)}`,
        "GitHub Actions configuration",
        generatedAt < ROCKET_LIVE_SYNC_START ? "waiting" : "healthy",
      ),
      healthMetric(
        "Runtime",
        "RESPONDING",
        `Server functions in ${process.env.VERCEL_REGION ?? "local"}`,
        "Vercel runtime",
        "healthy",
      ),
    ],
    fieldTiers: fieldGroups
      .map((group) => ({ tier: group.tier, count: group._count._all }))
      .sort((left, right) => tierOrder(left.tier) - tierOrder(right.tier)),
    jobs: jobsMapped,
    incidents,
    recentAudit: campaign.auditEvents,
  };
}

function metric(
  label: string,
  value: number,
  detail: string,
  source: string,
  href?: string,
): OperationsMetric {
  return {
    label,
    value: value.toString(),
    detail,
    source,
    href,
    tone: "healthy",
  };
}

function healthMetric(
  label: string,
  value: string,
  detail: string,
  source: string,
  tone: OperationsTone,
  href?: string,
): OperationsMetric {
  return { label, value, detail, source, tone, href };
}

function mapJobs(
  jobs: Array<{
    key: string;
    name: string;
    source: string;
    staleAfterMinutes: number | null;
    runs: Array<{
      status: string;
      startedAt: Date;
      completedAt: Date | null;
      recordsProcessed: number | null;
      summary: string | null;
    }>;
  }>,
  now: Date,
): OperationsJobStatus[] {
  const databaseJobs = new Map(jobs.map((job) => [job.key, job]));
  const contracts = [
    ...OPERATIONAL_JOB_CONTRACTS,
    ...jobs
      .filter(
        (job) =>
          !OPERATIONAL_JOB_CONTRACTS.some(
            (contract) => contract.key === job.key,
          ),
      )
      .map<OperationalJobContract>((job) => ({
        key: job.key,
        name: job.name,
        source: job.source,
        staleAfterMinutes: job.staleAfterMinutes ?? undefined,
        scheduleKind: "manual",
      })),
  ];

  return contracts.map((contract) => {
    const job = databaseJobs.get(contract.key);
    const run = job?.runs[0] ?? null;
    const beforeFirstRun = Boolean(
      contract.firstExpectedAt && now < contract.firstExpectedAt,
    );
    const afterWindow = Boolean(
      contract.windowEndsAt && now > contract.windowEndsAt,
    );
    const outsideLiveWindow = beforeFirstRun || afterWindow;
    const stale =
      run?.completedAt &&
      contract.staleAfterMinutes &&
      !outsideLiveWindow &&
      now.getTime() - run.completedAt.getTime() >
        contract.staleAfterMinutes * 60_000;
    const missingExpectedRun = Boolean(
      !run &&
        contract.firstExpectedAt &&
        contract.staleAfterMinutes &&
        now.getTime() - contract.firstExpectedAt.getTime() >
          contract.staleAfterMinutes * 60_000 &&
        !afterWindow,
    );
    const status = stale
      ? "STALE"
      : missingExpectedRun
        ? "STALE"
      : run?.status ??
        (beforeFirstRun
          ? "SCHEDULED"
          : afterWindow
            ? "WINDOW ENDED"
            : contract.scheduleKind === "event"
              ? "READY"
              : contract.scheduleKind === "manual"
                ? "AWAITING MANUAL RUN"
                : "AWAITING FIRST RUN");
    const tone: OperationsTone =
      status === "FAILED" || status === "STALE"
        ? "critical"
        : status === "SUCCESS" || status === "WINDOW ENDED"
          ? "healthy"
          : "waiting";
    return {
      key: contract.key,
      name: contract.name,
      source: contract.source,
      status,
      tone,
      lastRunAt: run?.startedAt ?? null,
      completedAt: run?.completedAt ?? null,
      recordsProcessed: run?.recordsProcessed ?? null,
      summary: run?.summary ?? null,
    };
  });
}

async function readPushSubscriptionCount(): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "PushSubscription"
    `;
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

function buildIncidents(input: {
  databaseLatencyMs: number;
  campaignStatus: string;
  fieldStatus: string;
  tournamentStatus: string;
  teamCount: number;
  incompleteTeams: number;
  jobs: OperationsJobStatus[];
}): OperationsCockpit["incidents"] {
  const incidents: OperationsCockpit["incidents"] = [];
  if (input.databaseLatencyMs > 1_000) {
    incidents.push({
      id: "database-slow",
      title: "Database response is slow",
      detail: `The cockpit read took ${input.databaseLatencyMs} ms.`,
      tone: "warning",
    });
  }
  for (const job of input.jobs.filter(
    (candidate) => candidate.status === "FAILED" || candidate.status === "STALE",
  )) {
    incidents.push({
      id: `job-${job.key}`,
      title: `${job.name} is ${job.status.toLowerCase()}`,
      detail: job.summary ?? `Last observed from ${job.source}.`,
      tone: "critical",
    });
  }
  if (input.campaignStatus === "FINAL" && input.fieldStatus !== "FROZEN") {
    incidents.push({
      id: "final-without-field",
      title: "Final campaign has no frozen field",
      detail: "Campaign and field state are inconsistent.",
      tone: "critical",
    });
  }
  if (
    input.tournamentStatus === "completed" &&
    input.campaignStatus !== "FINAL"
  ) {
    incidents.push({
      id: "rocket-result-not-final",
      title: "Rocket result is not sealed",
      detail:
        input.incompleteTeams > 0
          ? `${input.incompleteTeams} of ${input.teamCount} teams still lack a complete 20-round score.`
          : "All team scores are complete, but campaign finalization has not succeeded.",
      tone: "critical",
    });
  }
  return incidents;
}

function tierOrder(tier: string): number {
  return ["T1_10", "T11_20", "T21_30", "T31_50", "T51_PLUS"].indexOf(tier);
}

function formatRelative(date: Date, now: Date): string {
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - date.getTime()) / 60_000),
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function formatDate(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

export const ROCKET_OPERATIONS_TOURNAMENT_ID = ROCKET_BETA_TOURNAMENT_ID;
