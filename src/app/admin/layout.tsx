import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AdminSidebar from "./components/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();

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
