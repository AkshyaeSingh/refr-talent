// Next.js instrumentation hook — runs once when the server process starts.
// We use it to kick off the weekly Airtable auto-sync loop. Guarded to the
// Node.js runtime (skips the edge runtime), and the loop itself is idempotent.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAutoSync } = await import("@/lib/autoSync");
    startAutoSync();
  }
}
