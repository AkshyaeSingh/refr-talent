import Logo from "@/components/Logo";
import { ConnectAnimation, SearchAnimation } from "@/components/FeatureAnimation";
import { ONE_LINER, PROBLEM, TAGLINE_A, TAGLINE_B } from "@/lib/marketing";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-6 flex items-center gap-3">
        <Logo size={30} />
      </div>

      {/* One line: what it is */}
      <h1 className="text-2xl font-bold leading-snug">{ONE_LINER}</h1>

      {/* The problem */}
      <p className="mt-4 text-sm leading-6 text-neutral-600">{PROBLEM}</p>

      <h2 className="mt-10 mb-4 text-xs font-semibold uppercase tracking-widest text-purple-600">
        What Refr lets you do
      </h2>

      {/* Feature 1 — connect */}
      <section className="mb-8">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">1</span>
          <h3 className="text-base font-semibold">Connect your talent pool and make it discoverable</h3>
        </div>
        <p className="mb-3 pl-8 text-sm text-neutral-600">
          Plug in Airtable, Typeform, or a CSV once. Your applicants become discoverable to the
          fellowships and hiring orgs you trust — no exports, no manual sharing.
        </p>
        <ConnectAnimation />
      </section>

      {/* Feature 2 — search */}
      <section className="mb-8">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">2</span>
          <h3 className="text-base font-semibold">Search applicants by your criteria — a constant sourcing pipeline</h3>
        </div>
        <p className="mb-3 pl-8 text-sm text-neutral-600">
          Describe who you want in plain language. Refr searches across the network — EA at Stanford,
          a BlueDot AGI Strategy cohort, the MATS AI track — and surfaces the people who fit.
        </p>
        <SearchAnimation />
      </section>

      <p className="mb-6 text-sm text-neutral-600">
        No more emailing spreadsheets back and forth. Talent flows to where it&apos;s needed —
        securely, and only with the applicant&apos;s consent.
      </p>

      {/* Tagline */}
      <div className="rounded-2xl bg-purple-50 p-6 text-center">
        <p className="text-lg font-bold text-purple-900">{TAGLINE_A}</p>
        <p className="text-lg font-bold text-purple-900">{TAGLINE_B}</p>
      </div>
    </div>
  );
}
