"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "@/components/Logo";

type SavedSearch = { id: string; name: string };

const NAV = [
  { href: "/dashboard", label: "Search", icon: SearchIcon },
  { href: "/dashboard/friends", label: "Friends", icon: FriendsIcon },
  { href: "/dashboard/integrations", label: "Integrations", icon: ConnectorsIcon },
];

export default function Sidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [searches, setSearches] = useState<SavedSearch[]>([]);

  const loadSearches = useCallback(async () => {
    const res = await fetch("/api/searches");
    if (res.ok) {
      const data = await res.json();
      setSearches(data.searches ?? []);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, no data library in use
    loadSearches();
    const handler = () => loadSearches();
    window.addEventListener("history-updated", handler);
    return () => window.removeEventListener("history-updated", handler);
  }, [loadSearches]);

  async function remove(id: string) {
    await fetch(`/api/searches/${id}`, { method: "DELETE" });
    loadSearches();
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-sidebar">
      <div className="flex items-center px-5 py-4">
        <Logo size={22} />
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${active ? "nav-item-active" : ""}`}
            >
              <Icon />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 flex-1 overflow-y-auto px-3">
        <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          History
        </div>
        <div className="flex flex-col gap-0.5">
          {searches.length === 0 && (
            <p className="px-3 py-1 text-xs text-neutral-400">Saved searches appear here.</p>
          )}
          {searches.map((s) => {
            const href = `/dashboard?s=${s.id}`;
            return (
              <div key={s.id} className="group flex items-center">
                <button
                  onClick={() => router.push(href)}
                  className="flex-1 truncate rounded-lg px-3 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  title={s.name}
                >
                  {s.name}
                </button>
                <button
                  onClick={() => remove(s.id)}
                  className="mr-1 hidden rounded px-1.5 text-neutral-400 hover:text-red-600 group-hover:block"
                  title="Delete saved search"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <Link
        href="/dashboard/profile"
        className={`flex items-center gap-3 border-t border-neutral-200 px-5 py-3 transition-colors hover:bg-neutral-100 ${
          pathname === "/dashboard/profile" ? "bg-neutral-100" : ""
        }`}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white">
          {orgName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{orgName}</div>
          <div className="truncate text-xs text-neutral-500">Profile &amp; integrations</div>
        </div>
      </Link>
    </aside>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function FriendsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function ConnectorsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-6" />
    </svg>
  );
}
