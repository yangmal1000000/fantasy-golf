import { notFound } from "next/navigation";
import { isAdminOwner } from "@/lib/admin-owner";
import { getCurrentUser } from "@/lib/auth";

export default async function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !isAdminOwner(user.email)) notFound();

  return children;
}
