"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ProfileMenu({ orgName, userName }: { orgName: string; userName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white"
        title={`${orgName} · ${userName}`}
      >
        {orgName.slice(0, 2).toUpperCase()}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 px-4 py-3">
            <div className="text-sm font-semibold">{orgName}</div>
            <div className="text-xs text-neutral-500">{userName}</div>
          </div>
          <Link href="/dashboard/profile" className="block px-4 py-2 text-sm hover:bg-neutral-50">
            Profile &amp; integrations
          </Link>
          <Link href="/dashboard/journey" className="block px-4 py-2 text-sm hover:bg-neutral-50">
            Talent Journey
          </Link>
          <Link href="/dashboard/about" className="block px-4 py-2 text-sm hover:bg-neutral-50">
            About Refr
          </Link>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login");
              router.refresh();
            }}
            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-neutral-50"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
