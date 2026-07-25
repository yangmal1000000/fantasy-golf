import { NextResponse } from "next/server";
import { adminApiActor } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await adminApiActor(request, {
    required: "REVEAL_CUSTOMER_PII",
  });
  if (access.denied || !access.actor) {
    return access.denied ?? NextResponse.json({ error: "Denied" }, { status: 403 });
  }

  const { id } = await params;
  const body = await safeBody(request);
  const reason =
    typeof body.reason === "string" && body.reason.trim().length >= 8
      ? body.reason.trim().slice(0, 200)
      : null;
  if (!reason) {
    return NextResponse.json(
      { error: "A reason is required" },
      { status: 400 },
    );
  }

  const customer = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.adminAuditEvent.create({
    data: {
      actorUserId: access.actor.id,
      actorEmail: access.actor.email,
      actorRole: access.actor.role,
      action: "customer.pii.email.revealed",
      resourceType: "User",
      resourceId: customer.id,
      reason,
      requestId: request.headers.get("x-vercel-id") ?? crypto.randomUUID(),
      metadata: {
        field: "email",
        route: "admin.customer.detail",
      },
    },
  });

  return NextResponse.json(
    { email: customer.email },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

async function safeBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
