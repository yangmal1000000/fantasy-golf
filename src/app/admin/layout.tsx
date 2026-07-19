import { cookies } from "next/headers";
import AdminSidebar from "./components/AdminSidebar";
import AdminGate from "./components/AdminGate";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get("admin_auth")?.value === "1";

  if (!isAdmin) {
    return <AdminGate />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      {/* Sidebar is fixed w-64, so add left padding on large screens */}
      <div className="lg:pl-64">
        <div className="min-h-screen">{children}</div>
      </div>
    </div>
  );
}
