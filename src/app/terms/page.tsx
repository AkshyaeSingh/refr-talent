import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata = { title: "Terms of Service — Refr" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <Link href="/landing"><Logo size={22} /></Link>
      <h1 className="mt-8 text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-neutral-500">Last updated July 2026.</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-6 text-neutral-700">
        <p>
          These terms cover use of Refr, a talent-sharing platform for AI-safety fellowships,
          training programs, and hiring orgs. By creating an org account or using a quick-share
          link, you agree to these terms.
        </p>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">What Refr does</h2>
          <p className="mt-1">
            Refr lets an org import an applicant/candidate pool (via CSV upload or a connected
            source such as Airtable), search it with AI, and — only with each candidate&apos;s consent
            — make matching profiles discoverable to partner orgs it has approved a connection
            with, or share a set of profiles through a one-time quick-share link.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">Your responsibilities</h2>
          <p className="mt-1">
            You&apos;re responsible for having a lawful basis to store and share the candidate data you
            import, and for the accuracy of any consent signal (e.g. a &quot;share with partners&quot;
            question) attached to it. Don&apos;t import data you don&apos;t have the right to hold, and don&apos;t
            use Refr to share someone&apos;s information against their stated preference.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">Connected sources</h2>
          <p className="mt-1">
            When you connect Airtable via OAuth, you&apos;re granting Refr read-only access to the base
            and table you choose. You can disconnect at any time; disconnecting stops future syncs
            but does not automatically delete already-imported records (delete those from your pool,
            or ask us to delete your org entirely).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">No warranty</h2>
          <p className="mt-1">
            Refr is provided as-is. AI-derived fields (profile summaries, credential tags, search
            rankings) are best-effort and may be incomplete or wrong — they&apos;re a starting point for
            your own judgment, not a substitute for it.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">Changes</h2>
          <p className="mt-1">
            We may update these terms as the product evolves. Material changes will be reflected on
            this page with an updated date.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900">Contact</h2>
          <p className="mt-1">
            Questions about these terms:{" "}
            <a href="mailto:[SUPPORT_EMAIL]" className="text-purple-700 underline">[SUPPORT_EMAIL]</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
