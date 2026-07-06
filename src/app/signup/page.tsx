"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import ContourBackground from "@/components/ContourBackground";

export default function SignupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgName, name, email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not create account.");
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <ContourBackground />
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white/80 p-8 shadow-xl backdrop-blur">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={28} />
          <div>
            <h1 className="text-xl font-semibold">Create your org</h1>
            <p className="text-sm text-neutral-500">
              Set up your talent pool and start connecting.
            </p>
          </div>
        </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Organization name">
          <input
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="input"
            placeholder="MATS"
          />
        </Field>
        <Field label="Your name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Jane Doe"
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="jane@org.org"
          />
        </Field>
        <Field label="Password">
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
        <p className="mt-6 text-center text-sm text-neutral-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-purple-700 underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
