import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import ProfileMenu from "@/components/ProfileMenu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar orgName={user.org.name} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-end border-b border-neutral-200 px-6 py-3">
          <ProfileMenu orgName={user.org.name} userName={user.name} />
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
