import { requireAdminCapability } from "@/lib/admin-session";

export default async function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminCapability("VIEW_CUSTOMERS");

  return children;
}
