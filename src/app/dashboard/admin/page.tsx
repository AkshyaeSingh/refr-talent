import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  const [orgs, waitlist, suggestions, feedback, candidateCount, connectionCount] = await Promise.all([
    prisma.org.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { candidates: true, users: true, savedSearches: true, connectors: true } },
        users: { select: { email: true, name: true }, take: 1, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.integrationSuggestion.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { org: { select: { name: true } } } }),
    prisma.feedback.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.candidate.count(),
    prisma.orgConnection.count({ where: { status: "APPROVED" } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="mt-1 text-sm text-neutral-500">Operator view — orgs, activity, waitlist, and feedback.</p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Orgs" value={orgs.length} />
        <Stat label="Candidates" value={candidateCount} />
        <Stat label="Connections" value={connectionCount} />
        <Stat label="Waitlist" value={waitlist.length} />
      </div>

      {/* Orgs */}
      <Section title={`Registered orgs (${orgs.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="py-2 pr-4">Org</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Admin</th>
                <th className="py-2 pr-4 text-right">Pool</th>
                <th className="py-2 pr-4 text-right">Searches</th>
                <th className="py-2 pr-4 text-right">Sources</th>
                <th className="py-2 pr-4">Joined</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-t border-neutral-100">
                  <td className="py-2 pr-4 font-medium">
                    {o.name}
                    {o.website && (
                      <a href={o.website} target="_blank" rel="noreferrer" className="ml-1.5 text-xs text-purple-600 underline">
                        site
                      </a>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-neutral-500">{o.orgType ?? "—"}</td>
                  <td className="py-2 pr-4 text-neutral-500">{o.users[0]?.email ?? "—"}</td>
                  <td className="py-2 pr-4 text-right">{o._count.candidates}</td>
                  <td className="py-2 pr-4 text-right">{o._count.savedSearches}</td>
                  <td className="py-2 pr-4 text-right">{o._count.connectors}</td>
                  <td className="py-2 pr-4 text-neutral-500">{fmt(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Feedback */}
      <Section title={`Feedback (${feedback.length})`}>
        {feedback.length === 0 ? (
          <Empty>No feedback yet.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {feedback.map((f) => (
              <div key={f.id} className="rounded-xl border border-neutral-200 p-3">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>{f.userName ?? "?"} · {f.userEmail ?? "?"}{f.path ? ` · ${f.path}` : ""}</span>
                  <span>{fmt(f.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{f.message}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Waitlist */}
      <Section title={`Waitlist (${waitlist.length})`}>
        {waitlist.length === 0 ? (
          <Empty>No waitlist signups yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="py-2 pr-4">Org</th>
                  <th className="py-2 pr-4">Contact</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Website</th>
                  <th className="py-2 pr-4">When</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.map((w) => (
                  <tr key={w.id} className="border-t border-neutral-100">
                    <td className="py-2 pr-4 font-medium">{w.orgName}</td>
                    <td className="py-2 pr-4 text-neutral-600">{w.contactName}</td>
                    <td className="py-2 pr-4 text-neutral-600">{w.email}</td>
                    <td className="py-2 pr-4">
                      {w.website ? (
                        <a href={w.website} target="_blank" rel="noreferrer" className="text-purple-600 underline">link</a>
                      ) : "—"}
                    </td>
                    <td className="py-2 pr-4 text-neutral-500">{fmt(w.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Integration suggestions */}
      <Section title={`Integration requests (${suggestions.length})`}>
        {suggestions.length === 0 ? (
          <Empty>No requests yet.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <div key={s.id} className="rounded-xl border border-neutral-200 p-3 text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="text-neutral-400"> · {s.org?.name ?? "?"} · {fmt(s.createdAt)}</span>
                {s.reason && <p className="mt-0.5 text-neutral-600">{s.reason}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-neutral-400">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-400">{children}</p>;
}
