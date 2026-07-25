import type { Metadata } from "next";
import { requireAdminCapability } from "@/lib/admin-session";
import AdminSidebar from "./components/AdminSidebar";

export const metadata: Metadata = {
  title: "Operations — Fantasy Golf",
  description: "Private Fantasy Golf operations and customer administration.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireAdminCapability("VIEW_DASHBOARD");

  return (
    <div className="min-h-screen bg-[#f4f6f3] dark:bg-[#0b0e0c]">
      <AdminSidebar role={actor.role} />
      <div className="lg:pl-64">
        <div className="min-h-screen">{children}</div>
      </div>
    </div>
  );
}
