"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Admin-allowlisted accounts are for managing the app, not using it as a
// tenant — so redirect them off every regular dashboard surface (Search,
// Friends, Integrations, etc.) straight to /dashboard/admin. Excludes
// /dashboard/admin itself so this doesn't loop.
export default function AdminGate({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isAdmin && !pathname.startsWith("/dashboard/admin")) {
      router.replace("/dashboard/admin");
    }
  }, [isAdmin, pathname, router]);

  return null;
}
