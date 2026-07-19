import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export async function GET() {
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
