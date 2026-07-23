import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminApiGuard } from "@/lib/admin-auth";

// ---------- PATCH: Update team (toggle paid, etc.) ----------
export async function PATCH(req: NextRequest) {
  const denied = await adminApiGuard(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { teamId, paid } = body as {
      teamId: string;
      paid?: boolean;
    };

    if (!teamId) {
      return NextResponse.json({ error: "teamId required" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (paid !== undefined) data.paid = paid;

    await prisma.team.update({
      where: { id: teamId },
      data,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Team update error:", err);
    return NextResponse.json(
      { error: "Failed to update team" },
      { status: 500 }
    );
  }
}

// ---------- DELETE: Delete team ----------
export async function DELETE(req: NextRequest) {
  const denied = await adminApiGuard(req);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json({ error: "teamId required" }, { status: 400 });
    }

    // Delete selections first, then team
    await prisma.teamSelection.deleteMany({ where: { teamId } });
    await prisma.team.delete({ where: { id: teamId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Team delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete team" },
      { status: 500 }
    );
  }
}
