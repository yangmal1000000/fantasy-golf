import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// DELETE — remove a saved team template
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership before deleting
    const savedTeam = await prisma.savedTeam.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!savedTeam) {
      return NextResponse.json({ error: "Saved team not found" }, { status: 404 });
    }

    if (savedTeam.userId !== user.id) {
      return NextResponse.json({ error: "Not authorised to delete this team" }, { status: 403 });
    }

    // Cascade delete handles SavedTeamPlayer rows
    await prisma.savedTeam.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Saved team DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete saved team" }, { status: 500 });
  }
}
