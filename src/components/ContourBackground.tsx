// Light, flowing topographic-style line texture for the auth pages.
// Paths are generated deterministically (no randomness) so server and client
// render identically. Purely decorative.
const W = 1440;
const H = 900;

function buildLines(): string[] {
  const lines: string[] = [];
  const count = 42;
  for (let i = 0; i < count; i++) {
    const baseY = (H / (count - 1)) * i;
    // Vary amplitude/frequency/phase per line for an organic, fingerprint-like flow.
    const amp = 26 + 18 * Math.sin(i * 0.7);
    const freq = 0.004 + 0.0016 * Math.sin(i * 0.4);
    const phase = i * 0.6;
    const drift = 60 * Math.sin(i * 0.25); // gentle vertical drift across the field

    let d = `M -40 ${baseY + drift}`;
    for (let x = 0; x <= W + 40; x += 24) {
      const y = baseY + drift + amp * Math.sin(x * freq + phase);
      d += ` L ${x} ${y.toFixed(1)}`;
    }
    lines.push(d);
  }
  return lines;
}

const LINES = buildLines();

export default function ContourBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-white">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        aria-hidden="true"
      >
        <g stroke="#e5e7eb" strokeWidth="1" fill="none">
          {LINES.map((d, i) => (
            <path key={i} d={d} strokeOpacity={0.7} />
          ))}
        </g>
      </svg>
      {/* Soft radial fade toward the center so the form stays readable. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.45) 45%, rgba(255,255,255,0) 100%)",
        }}
      />
    </div>
  );
}
