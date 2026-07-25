import "server-only";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  hasAdminCapability,
  isAdminRole,
  type AdminCapability,
  type AdminRoleName,
} from "@/lib/admin-roles";
import { createClient } from "@/utils/supabase/server";

export interface AdminActor {
  id: string;
  email: string;
  name: string | null;
  role: AdminRoleName;
}

export async function getAdminActor(): Promise<AdminActor | null> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser?.email) return null;

  // Admin monitoring reads must never create or update customer records.
  const user = await prisma.user.findUnique({
    where: { email: authUser.email },
    select: {
      id: true,
      email: true,
      name: true,
      adminRole: true,
    },
  });
  if (!user || !isAdminRole(user.adminRole)) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.adminRole,
  };
}

export async function requireAdminCapability(
  capability: AdminCapability,
): Promise<AdminActor> {
  const actor = await getAdminActor();
  if (!actor || !hasAdminCapability(actor.role, capability)) notFound();
  return actor;
}
