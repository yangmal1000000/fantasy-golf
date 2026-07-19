import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

/**
 * Returns the currently authenticated user from the Supabase session.
 * If the user exists in the Supabase session but not yet in our Prisma
 * database, they are upserted automatically.
 *
 * Returns null when no Supabase session is present.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.email) return null;

  const user = await prisma.user.upsert({
    where: { email: session.user.email },
    update: {
      name: session.user.user_metadata?.full_name ?? session.user.email,
      avatar: session.user.user_metadata?.avatar_url ?? null,
    },
    create: {
      email: session.user.email,
      name: session.user.user_metadata?.full_name ?? session.user.email,
      avatar: session.user.user_metadata?.avatar_url ?? null,
    },
  });

  return user;
}

/**
 * Returns the current user's ID, or falls back to the demo user for
 * development/read-only views when no one is signed in.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user) return user.id;

  // Fallback to demo user for development
  const demo = await prisma.user.findUnique({
    where: { email: "demo@fantasygolf.com" },
  });
  return demo?.id ?? null;
}

/**
 * Returns the current user or redirects to the home page.
 * Use in pages/actions that require authentication.
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }
  return user;
}
