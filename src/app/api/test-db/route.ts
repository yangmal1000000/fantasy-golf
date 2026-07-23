import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { adminApiGuard } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const denied = await adminApiGuard(request);
  if (denied) return denied;
  try {
    const prisma = new PrismaClient();
    const count = await prisma.tournament.count();
    await prisma.$disconnect();
    return NextResponse.json({ ok: true, tournaments: count });
  } catch (e) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e).slice(0, 500),
    }, { status: 500 });
  }
}
