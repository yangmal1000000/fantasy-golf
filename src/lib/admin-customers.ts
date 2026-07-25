import "server-only";

import { prisma } from "@/lib/prisma";
import { ROCKET_BETA_CAMPAIGN_SLUG } from "@/lib/rocket-beta";
import {
  deriveCustomerAccess,
  deriveCustomerStage,
  isDemoCustomer,
  latestRecordedAt,
  type CustomerAccess,
  type CustomerLifecycleInput,
  type CustomerStage,
} from "@/lib/admin-customer-core";
import { isAdminOwner } from "@/lib/admin-owner";

export interface AdminCustomerSummary {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  isOwner: boolean;
  isDemo: boolean;
  createdAt: Date;
  lastRecordedAt: Date;
  stage: CustomerStage;
  access: CustomerAccess;
  rocketMember: boolean;
  targetComplete: boolean;
  passStatus: string | null;
  draftSaved: boolean;
  officialTeam: boolean;
  teamCount: number;
  leagueCount: number;
  notificationCount: number;
}

export interface AdminCustomerOverview {
  generatedAt: Date;
  campaignName: string | null;
  accounts: number;
  demoAccounts: number;
  rocketParticipants: number;
  targetComplete: number;
  testPasses: number;
  draftsSaved: number;
  officialTeams: number;
  unlinkedRocketMembers: number;
  customers: AdminCustomerSummary[];
}

export interface AdminCustomerTimelineEvent {
  id: string;
  label: string;
  detail: string | null;
  createdAt: Date;
  tone: "neutral" | "success" | "warning";
}

export interface AdminCustomerDetail extends AdminCustomerSummary {
  rocket: {
    campaignName: string | null;
    memberJoinedAt: Date | null;
    memberActive: boolean | null;
    targetSubmittedAt: Date | null;
    passUnlockedAt: Date | null;
    draftUpdatedAt: Date | null;
    draftFieldVersion: string | null;
    passRedeemedAt: Date | null;
  };
  teams: Array<{
    id: string;
    name: string;
    tournamentId: string;
    tournamentName: string;
    tournamentStatus: string;
    createdAt: Date;
    selectionCount: number;
  }>;
  leagues: Array<{
    id: string;
    name: string;
    joinedAt: Date;
  }>;
  savedTeams: Array<{
    id: string;
    name: string;
    isDefault: boolean;
    updatedAt: Date;
    playerCount: number;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    type: string;
    read: boolean;
    createdAt: Date;
  }>;
  timeline: AdminCustomerTimelineEvent[];
}

export async function readAdminCustomerOverview(): Promise<AdminCustomerOverview> {
  const [users, campaign] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        isAdmin: true,
        createdAt: true,
        teams: {
          select: {
            tournamentId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            teams: true,
            leagues: true,
            notifications: true,
          },
        },
      },
    }),
    prisma.rocketBetaCampaign.findUnique({
      where: { slug: ROCKET_BETA_CAMPAIGN_SLUG },
      include: {
        members: {
          include: { passes: true },
        },
      },
    }),
  ]);

  const targetEntries = campaign
    ? await prisma.targetPilotEntry.findMany({
        where: { roundId: campaign.targetRoundId },
        select: { email: true, submittedAt: true },
      })
    : [];
  const targetByEmail = new Map(
    targetEntries.map((entry) => [normaliseEmail(entry.email), entry]),
  );
  const memberByUserId = new Map(
    (campaign?.members ?? [])
      .filter((member) => member.userId)
      .map((member) => [member.userId as string, member]),
  );
  const memberByEmail = new Map(
    (campaign?.members ?? []).map((member) => [normaliseEmail(member.email), member]),
  );

  const customers = users.map<AdminCustomerSummary>((user) => {
    const member =
      memberByUserId.get(user.id) ?? memberByEmail.get(normaliseEmail(user.email)) ?? null;
    const pass =
      member?.passes.find((candidate) => candidate.userId === user.id) ??
      member?.passes[0] ??
      null;
    const target = targetByEmail.get(normaliseEmail(user.email)) ?? null;
    const hasOfficialTeam = Boolean(
      pass?.teamId ||
        (campaign &&
          user.teams.some((team) => team.tournamentId === campaign.tournamentId)),
    );
    const owner = isAdminOwner(user.email);
    const lifecycle = lifecycleInput({
      isOwner: owner,
      member,
      targetSubmittedAt: target?.submittedAt ?? null,
      pass,
      hasOfficialTeam,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name?.trim() || user.email,
      avatar: user.avatar,
      isOwner: owner,
      isDemo: isDemoCustomer(user.email),
      createdAt: user.createdAt,
      lastRecordedAt: latestRecordedAt(
        user.createdAt,
        member?.acceptedAt,
        member?.invitedAt,
        target?.submittedAt,
        pass?.unlockedAt,
        pass?.draftUpdatedAt,
        pass?.redeemedAt,
        user.teams[0]?.createdAt,
      ),
      stage: deriveCustomerStage(lifecycle),
      access: deriveCustomerAccess(lifecycle),
      rocketMember: Boolean(member),
      targetComplete: Boolean(target),
      passStatus: pass?.status ?? null,
      draftSaved: Boolean(pass?.draftUpdatedAt),
      officialTeam: hasOfficialTeam,
      teamCount: user._count.teams,
      leagueCount: user._count.leagues,
      notificationCount: user._count.notifications,
    };
  });

  const linkedMemberIds = new Set(
    customers.filter((customer) => customer.rocketMember).map((customer) => customer.id),
  );
  const unlinkedRocketMembers = (campaign?.members ?? []).filter(
    (member) => !member.userId || !linkedMemberIds.has(member.userId),
  ).length;

  return {
    generatedAt: new Date(),
    campaignName: campaign?.name ?? null,
    accounts: customers.length,
    demoAccounts: customers.filter((customer) => customer.isDemo).length,
    rocketParticipants: customers.filter((customer) => customer.rocketMember).length,
    targetComplete: customers.filter((customer) => customer.targetComplete).length,
    testPasses: customers.filter((customer) => customer.passStatus).length,
    draftsSaved: customers.filter((customer) => customer.draftSaved).length,
    officialTeams: customers.filter((customer) => customer.officialTeam).length,
    unlinkedRocketMembers,
    customers,
  };
}

export async function readAdminCustomerDetail(
  customerId: string,
): Promise<AdminCustomerDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      isAdmin: true,
      createdAt: true,
      teams: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          tournamentId: true,
          createdAt: true,
          tournament: {
            select: { name: true, status: true },
          },
          _count: { select: { selections: true } },
        },
      },
      leagues: {
        orderBy: { joinedAt: "desc" },
        select: {
          id: true,
          joinedAt: true,
          league: { select: { name: true } },
        },
      },
      savedTeams: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          isDefault: true,
          updatedAt: true,
          _count: { select: { players: true } },
        },
      },
      notifications: {
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          title: true,
          type: true,
          read: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          teams: true,
          leagues: true,
          notifications: true,
        },
      },
    },
  });
  if (!user) return null;

  const campaign = await prisma.rocketBetaCampaign.findUnique({
    where: { slug: ROCKET_BETA_CAMPAIGN_SLUG },
  });
  const member = campaign
    ? await prisma.rocketBetaMember.findFirst({
        where: {
          campaignId: campaign.id,
          OR: [{ userId: user.id }, { email: user.email }],
        },
        include: { passes: true },
      })
    : null;
  const pass =
    member?.passes.find((candidate) => candidate.userId === user.id) ??
    member?.passes[0] ??
    null;
  const [targetEntry, auditEvents] = campaign
    ? await Promise.all([
        prisma.targetPilotEntry.findFirst({
          where: { roundId: campaign.targetRoundId, email: user.email },
          select: { id: true, submittedAt: true },
        }),
        prisma.rocketBetaAudit.findMany({
          where: {
            campaignId: campaign.id,
            OR: [{ actorUserId: user.id }, { actorEmail: user.email }],
          },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: { id: true, action: true, createdAt: true },
        }),
      ])
    : [null, []];
  const hasOfficialTeam = Boolean(
    pass?.teamId ||
      (campaign &&
        user.teams.some((team) => team.tournamentId === campaign.tournamentId)),
  );
  const owner = isAdminOwner(user.email);
  const lifecycle = lifecycleInput({
    isOwner: owner,
    member,
    targetSubmittedAt: targetEntry?.submittedAt ?? null,
    pass,
    hasOfficialTeam,
  });
  const auditActions = new Set(auditEvents.map((event) => event.action));

  const timeline: AdminCustomerTimelineEvent[] = [
    {
      id: `account-${user.id}`,
      label: "Account created",
      detail: "Fantasy Golf customer record",
      createdAt: user.createdAt,
      tone: "neutral" as const,
    },
    ...(member && !auditActions.has("participant_joined")
      ? [
          {
            id: `member-${member.id}`,
            label: "Joined Rocket test flight",
            detail: member.active ? "Participant access active" : "Participant deactivated",
            createdAt: member.acceptedAt ?? member.invitedAt,
            tone: member.active ? ("success" as const) : ("warning" as const),
          },
        ]
      : []),
    ...(targetEntry
      ? [
          {
            id: `target-${targetEntry.id}`,
            label: "Completed Target",
            detail: "Locked Target submission",
            createdAt: targetEntry.submittedAt,
            tone: "success" as const,
          },
        ]
      : []),
    ...(pass && !auditActions.has("test_pass_unlocked")
      ? [
          {
            id: `pass-${pass.id}`,
            label: "Test Pass unlocked",
            detail: pass.status,
            createdAt: pass.unlockedAt,
            tone: pass.status === "REVOKED" ? ("warning" as const) : ("success" as const),
          },
        ]
      : []),
    ...(pass?.draftUpdatedAt &&
    !auditActions.has("rocket_provisional_draft_saved") &&
    !auditActions.has("rocket_provisional_draft_updated")
      ? [
          {
            id: `draft-${pass.id}`,
            label: "Rocket draft saved",
            detail: pass.draftFieldVersion
              ? `Field ${pass.draftFieldVersion}`
              : "Provisional five-player draft",
            createdAt: pass.draftUpdatedAt,
            tone: "success" as const,
          },
        ]
      : []),
    ...user.teams.map((team) => ({
      id: `team-${team.id}`,
      label: `Team created: ${team.name}`,
      detail: team.tournament.name,
      createdAt: team.createdAt,
      tone: "success" as const,
    })),
    ...auditEvents.map((event) => ({
      id: `audit-${event.id}`,
      label: formatAuditAction(event.action),
      detail: "Rocket audit record",
      createdAt: event.createdAt,
      tone: auditTone(event.action),
    })),
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 100);

  return {
    id: user.id,
    email: user.email,
    name: user.name?.trim() || user.email,
    avatar: user.avatar,
    isOwner: owner,
    isDemo: isDemoCustomer(user.email),
    createdAt: user.createdAt,
    lastRecordedAt: latestRecordedAt(
      user.createdAt,
      member?.acceptedAt,
      member?.invitedAt,
      targetEntry?.submittedAt,
      pass?.unlockedAt,
      pass?.draftUpdatedAt,
      pass?.redeemedAt,
      user.teams[0]?.createdAt,
    ),
    stage: deriveCustomerStage(lifecycle),
    access: deriveCustomerAccess(lifecycle),
    rocketMember: Boolean(member),
    targetComplete: Boolean(targetEntry),
    passStatus: pass?.status ?? null,
    draftSaved: Boolean(pass?.draftUpdatedAt),
    officialTeam: hasOfficialTeam,
    teamCount: user._count.teams,
    leagueCount: user._count.leagues,
    notificationCount: user._count.notifications,
    rocket: {
      campaignName: campaign?.name ?? null,
      memberJoinedAt: member ? member.acceptedAt ?? member.invitedAt : null,
      memberActive: member?.active ?? null,
      targetSubmittedAt: targetEntry?.submittedAt ?? null,
      passUnlockedAt: pass?.unlockedAt ?? null,
      draftUpdatedAt: pass?.draftUpdatedAt ?? null,
      draftFieldVersion: pass?.draftFieldVersion ?? null,
      passRedeemedAt: pass?.redeemedAt ?? null,
    },
    teams: user.teams.map((team) => ({
      id: team.id,
      name: team.name,
      tournamentId: team.tournamentId,
      tournamentName: team.tournament.name,
      tournamentStatus: team.tournament.status,
      createdAt: team.createdAt,
      selectionCount: team._count.selections,
    })),
    leagues: user.leagues.map((membership) => ({
      id: membership.id,
      name: membership.league.name,
      joinedAt: membership.joinedAt,
    })),
    savedTeams: user.savedTeams.map((team) => ({
      id: team.id,
      name: team.name,
      isDefault: team.isDefault,
      updatedAt: team.updatedAt,
      playerCount: team._count.players,
    })),
    notifications: user.notifications,
    timeline,
  };
}

function lifecycleInput({
  isOwner,
  member,
  targetSubmittedAt,
  pass,
  hasOfficialTeam,
}: {
  isOwner: boolean;
  member: {
    active: boolean;
  } | null;
  targetSubmittedAt: Date | null;
  pass: {
    status: string;
    unlockedAt: Date;
    draftUpdatedAt: Date | null;
    redeemedAt: Date | null;
  } | null;
  hasOfficialTeam: boolean;
}): CustomerLifecycleInput {
  return {
    isOwner,
    isRocketMember: Boolean(member),
    memberActive: member?.active ?? null,
    targetSubmittedAt,
    passStatus: pass?.status ?? null,
    passUnlockedAt: pass?.unlockedAt ?? null,
    draftUpdatedAt: pass?.draftUpdatedAt ?? null,
    passRedeemedAt: pass?.redeemedAt ?? null,
    hasOfficialTeam,
  };
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function formatAuditAction(action: string): string {
  return action
    .split("_")
    .map((part, index) =>
      index === 0 ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part,
    )
    .join(" ");
}

function auditTone(action: string): AdminCustomerTimelineEvent["tone"] {
  return action.includes("revoked") || action.includes("deactivated")
    ? "warning"
    : action.includes("saved") ||
        action.includes("unlocked") ||
        action.includes("joined") ||
        action.includes("confirmed")
      ? "success"
      : "neutral";
}
