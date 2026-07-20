import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
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
