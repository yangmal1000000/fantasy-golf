import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();

  return children;
}
