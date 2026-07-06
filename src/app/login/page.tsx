"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import ContourBackground from "@/components/ContourBackground";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not log in.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <ContourBackground />
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white/80 p-8 shadow-xl backdrop-blur">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={28} />
          <div>
            <h1 className="text-xl font-semibold">Welcome back</h1>
            <p className="text-sm text-neutral-500">Log in to your org</p>
          </div>
        </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
        <p className="mt-6 text-center text-sm text-neutral-500">
          Need an account?{" "}
          <Link href="/signup" className="font-medium text-purple-700 underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
