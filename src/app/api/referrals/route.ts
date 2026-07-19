import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureSchema, genId } from "@/lib/db-ensure";

export const dynamic = "force-dynamic";

interface ReferralRow {
  id: string;
  referredEmail: string;
  status: string;
  createdAt: Date;
}

interface VoucherRow {
  id: string;
  code: string;
  discountPercent: number;
  used: boolean;
  source: string;
  createdAt: Date;
}

interface ExistingReferralRow {
  id: string;
}

// GET — referral info for the signed-in user
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    await ensureSchema();

    // Referral code — derived stable from user id
    const referralCode = (user.id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "GOLFER") + "-" + user.id.slice(-4).toUpperCase();

    const referrals: ReferralRow[] = await prisma.$queryRawUnsafe(
      `SELECT id, "referredEmail", status, "createdAt"
         FROM "Referral"
        WHERE "referrerId" = $1
        ORDER BY "createdAt" DESC`,
      user.id,
    );

    const vouchers: VoucherRow[] = await prisma.$queryRawUnsafe(
      `SELECT id, code, "discountPercent", used, source, "createdAt"
         FROM "Voucher"
        WHERE "userId" = $1
        ORDER BY "createdAt" DESC`,
      user.id,
    );

    // Count completed referrals
    const completed = referrals.filter((r) => r.status === "completed").length;

    return NextResponse.json({
      referralCode,
      referralLink: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/?ref=${referralCode}`,
      stats: {
        invited: referrals.length,
        completed,
        vouchersEarned: vouchers.length,
        vouchersUsed: vouchers.filter((v) => v.used).length,
      },
      referrals: referrals.map((r) => ({
        id: r.id,
        email: r.referredEmail,
        status: r.status,
        createdAt: new Date(r.createdAt).toISOString(),
      })),
      vouchers: vouchers.map((v) => ({
        id: v.id,
        code: v.code,
        discountPercent: v.discountPercent,
        used: v.used,
        source: v.source,
        createdAt: new Date(v.createdAt).toISOString(),
      })),
    });
  } catch (err) {
    console.error("referrals GET error:", err);
    return NextResponse.json({ error: "Failed to load referrals" }, { status: 500 });
  }
}

// POST — create a new referral (track an invite)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const body = await req.json();
    const { referredEmail } = body as { referredEmail?: string };
    if (!referredEmail || !/^\S+@\S+\.\S+$/.test(referredEmail)) {
      return NextResponse.json({ error: "Valid referredEmail required" }, { status: 400 });
    }

    await ensureSchema();

    // Don't allow referring yourself
    if (referredEmail.toLowerCase() === user.email?.toLowerCase()) {
      return NextResponse.json({ error: "You can't refer yourself!" }, { status: 400 });
    }

    // Check for existing referral to the same email
    const existing: ExistingReferralRow[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM "Referral"
        WHERE "referrerId" = $1 AND "referredEmail" = $2
        LIMIT 1`,
      user.id,
      referredEmail.toLowerCase(),
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: "You've already referred this email", existing: true });
    }

    const id = genId();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Referral" (id, "referrerId", "referredEmail", status)
       VALUES ($1, $2, $3, 'pending')`,
      id,
      user.id,
      referredEmail.toLowerCase(),
    );

    return NextResponse.json({
      success: true,
      referral: { id, email: referredEmail, status: "pending" },
    });
  } catch (err) {
    console.error("referrals POST error:", err);
    return NextResponse.json({ error: "Failed to create referral" }, { status: 500 });
  }
}
