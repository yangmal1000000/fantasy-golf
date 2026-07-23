import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminApiGuard } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  const { feedId, enabled } = await request.json();

  if (!feedId || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Missing feedId or enabled" }, { status: 400 });
  }

  await prisma.feedStatus.update({
    where: { id: feedId },
    data: { enabled, updatedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
