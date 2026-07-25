import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROCKET_BETA_CAMPAIGN_SLUG } from "@/lib/rocket-beta";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

const FUNNEL_ACTIONS = {
  five_picks_selected: "rocket_funnel_five_picks_selected",
  review_opened: "rocket_funnel_review_opened",
} as const;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return privateJson({ error: "Cross-site request blocked" }, { status: 403 });
  }
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    return privateJson(
      { error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(contentLength) || contentLength > 1_024) {
    return privateJson({ error: "Request body is too large" }, { status: 413 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return privateJson({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    event?: keyof typeof FUNNEL_ACTIONS;
  } | null;
  const action = body?.event ? FUNNEL_ACTIONS[body.event] : null;
  if (!action) {
    return privateJson({ error: "Unsupported funnel event" }, { status: 400 });
  }

  try {
    const campaign = await prisma.rocketBetaCampaign.findUnique({
      where: { slug: ROCKET_BETA_CAMPAIGN_SLUG },
      select: { id: true },
    });
    if (!campaign) {
      return privateJson({ recorded: false }, { status: 202 });
    }

    const pass = await prisma.rocketBetaPass.findUnique({
      where: {
        campaignId_userId: {
          campaignId: campaign.id,
          userId: user.id,
        },
      },
      select: { id: true },
    });
    if (!pass) {
      return privateJson({ recorded: false }, { status: 202 });
    }

    const existing = await prisma.rocketBetaAudit.findFirst({
      where: {
        campaignId: campaign.id,
        actorUserId: user.id,
        action,
      },
      select: { id: true },
    });
    if (existing) {
      return privateJson({ recorded: false });
    }

    await prisma.rocketBetaAudit.create({
      data: {
        campaignId: campaign.id,
        actorUserId: user.id,
        action,
        payload: {
          source: "rocket_team_entry",
          passId: pass.id,
        },
      },
    });

    return privateJson({ recorded: true });
  } catch (error) {
    console.error("Rocket entry funnel event error", error);
    return privateJson({ recorded: false }, { status: 500 });
  }
}

function privateJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...PRIVATE_HEADERS, ...init?.headers },
  });
}
