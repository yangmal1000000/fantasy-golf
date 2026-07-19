import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const url = process.env.DATABASE_URL || "NOT SET";
  const masked = url.replace(/:[^:@]+@/, ":***@");
  
  try {
    const prisma = new PrismaClient();
    const count = await prisma.tournament.count();
    await prisma.$disconnect();
    return NextResponse.json({ ok: true, tournaments: count, url: masked.slice(0, 50) });
  } catch (e) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e).slice(0, 500), 
      url: masked.slice(0, 50) 
    }, { status: 500 });
  }
}
