import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/Sidebar";
import ProfileMenu from "@/components/ProfileMenu";
import FeedbackWidget from "@/components/FeedbackWidget";
import AdminGate from "@/components/AdminGate";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = isAdminEmail(user.email);
  // The first time an admin-allowlisted email is seen on an org, hide that
  // org from the network automatically — no manual step required.
  if (isAdmin && !user.org.hidden) {
    await prisma.org.update({ where: { id: user.orgId }, data: { hidden: true } }).catch(() => {});
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <AdminGate isAdmin={isAdmin} />
      <Sidebar orgName={user.org.name} isAdmin={isAdmin} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-end border-b border-neutral-200 px-6 py-3">
          <ProfileMenu orgName={user.org.name} userName={user.name} />
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <FeedbackWidget />
    </div>
  );
}
