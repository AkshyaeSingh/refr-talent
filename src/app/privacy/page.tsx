import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata = { title: "Privacy Policy — Refr" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <Link href="/landing"><Logo size={22} /></Link>
      <h1 className="mt-8 text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-neutral-500">Last updated July 2026.</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-6 text-neutral-700">
        <p>
          Refr is a talent-sharing platform used by AI-safety fellowships, training programs, and
          hiring orgs. This page explains what data we handle and how.
        </p>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">What we store</h2>
          <p className="mt-1">
            Org accounts store applicant/candidate records — name, contact details, skills,
            experience, and any answers imported from a CSV or a connected source (currently
            Airtable). We also use AI to derive a short profile (headline, summary, topics,
            credentials) from that data to make search useful.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">Cross-org sharing is consent-gated</h2>
          <p className="mt-1">
            A candidate&apos;s record is only ever visible to a partner org (a &quot;friend&quot; org, or via
            a one-time quick-share link) if that candidate&apos;s record is marked as consenting to be
            shared. Candidates who did not consent stay private to the org that imported them.
            Two orgs can only search each other&apos;s pools after both sides approve the connection.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">Airtable access</h2>
          <p className="mt-1">
            When you connect Airtable, we request read-only access
            (<code>data.records:read</code>, <code>schema.bases:read</code>) — we cannot create,
            edit, or delete anything in your Airtable. Access is scoped to the base and table you
            choose; other bases and workspaces stay invisible to us. OAuth tokens are encrypted at
            rest (AES-256-GCM).
          </p>
          <p className="mt-1">
            For the public quick-share flow (used by applicants&apos; sources who don&apos;t have a Refr
            account), the Airtable access token is never written to our database — it lives only in
            a short-lived (about 15 minutes), encrypted browser cookie for that one session, and
            nothing is stored in our system until the person sharing chooses who to send.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">Who can see what</h2>
          <p className="mt-1">
            Within an org, any logged-in member of that org can see its full candidate pool. Across
            orgs, only consenting candidates in an approved partner&apos;s pool are visible, and only to
            search — not automatically copied — until someone deliberately shares or pulls a record.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">Deletion</h2>
          <p className="mt-1">
            An org admin can request that their org and everything tied to it (candidates,
            connections, connectors, saved searches) be permanently deleted. Contact us to request
            this.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">Contact</h2>
          <p className="mt-1">
            Questions about this policy or your data:{" "}
            <a href="mailto:akshyaesingh@gmail.com" className="text-purple-700 underline">akshyaesingh@gmail.com</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
