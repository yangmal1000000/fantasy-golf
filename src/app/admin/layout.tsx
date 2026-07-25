import { requireAdminCapability } from "@/lib/admin-session";
import AdminSidebar from "./components/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireAdminCapability("VIEW_DASHBOARD");

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar role={actor.role} />
      {/* Sidebar is fixed w-64, so add left padding on large screens */}
      <div className="lg:pl-64">
        <div className="min-h-screen">{children}</div>
      </div>
    </div>
  );
}
