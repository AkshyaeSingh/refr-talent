"use client";

import { useEffect, useState } from "react";

// ── Connect: your pool → discoverable to a network of orgs ──────────────────
// A loop: you connect Airtable, then partner orgs light up around your pool.
const PARTNERS = [
  { label: "Apollo", x: 78, y: 18 },
  { label: "Redwood", x: 88, y: 50 },
  { label: "ARENA", x: 78, y: 82 },
  { label: "MATS", x: 55, y: 92 },
];

export function ConnectAnimation() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % 7), 850);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-purple-50 to-white">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {PARTNERS.map((p, i) => (
          <line
            key={p.label}
            x1="28"
            y1="50"
            x2={p.x}
            y2={p.y}
            stroke="#a855f7"
            strokeWidth="0.6"
            strokeDasharray="2 2"
            className="transition-opacity duration-500"
            style={{ opacity: phase > i + 1 ? 0.6 : 0 }}
          />
        ))}
      </svg>

      {/* Your pool */}
      <div className="absolute left-[10%] top-1/2 -translate-y-1/2">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-600 text-center text-[11px] font-bold leading-tight text-white shadow-lg">
            Your
            <br />
            pool
          </div>
          <div
            className="flex items-center gap-1 rounded-full border border-[#fcb400] bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-700 shadow-sm transition-all duration-500"
            style={{ opacity: phase >= 1 ? 1 : 0.3 }}
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-[#fcb400] text-[8px] font-bold text-white">A</span>
            Airtable {phase >= 1 && "✓"}
          </div>
        </div>
      </div>

      {/* Partner orgs */}
      {PARTNERS.map((p, i) => (
        <div
          key={p.label}
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            opacity: phase > i + 1 ? 1 : 0,
            transform: `translate(-50%,-50%) scale(${phase > i + 1 ? 1 : 0.6})`,
          }}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-purple-300 bg-white text-[10px] font-bold text-purple-700 shadow-sm">
            {p.label}
          </div>
        </div>
      ))}

      <div className="absolute bottom-2 left-3 text-[11px] font-medium text-neutral-500">
        Connect once → discoverable to your network
      </div>
    </div>
  );
}

// ── Search: type criteria → sources are searched → candidates surface ───────
const SOURCES = ["EA at Stanford", "BlueDot AGI Strategy course", "MATS — AI track"];
const QUERY = "Rigorous ML researchers with AI-safety program experience";
const RESULTS = [
  { name: "Dana L.", tag: "BlueDot · MATS", pct: 94 },
  { name: "Sam R.", tag: "EA Stanford · ARENA", pct: 88 },
  { name: "Priya N.", tag: "MATS · first-author", pct: 81 },
];

export function SearchAnimation() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => (v + 1) % 9), 700);
    return () => clearInterval(t);
  }, []);

  const typed = Math.min(QUERY.length, Math.round((tick / 4) * QUERY.length));

  return (
    <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-purple-50 to-white p-4">
      {/* Search bar */}
      <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="truncate text-xs text-neutral-700">
          {QUERY.slice(0, typed)}
          <span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-purple-500 align-middle" />
        </span>
      </div>

      {/* Sources being searched */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SOURCES.map((s, i) => (
          <span
            key={s}
            className="rounded-full px-2 py-0.5 text-[10px] font-medium transition-all duration-300"
            style={{
              backgroundColor: tick >= 4 + i ? "#f3e8ff" : "#f5f5f5",
              color: tick >= 4 + i ? "#7e22ce" : "#a3a3a3",
            }}
          >
            {tick >= 4 + i ? "✓ " : "⟳ "}
            {s}
          </span>
        ))}
      </div>

      {/* Results */}
      <div className="mt-3 flex flex-col gap-1.5">
        {RESULTS.map((r, i) => (
          <div
            key={r.name}
            className="flex items-center justify-between rounded-lg border border-neutral-100 bg-white px-2.5 py-1.5 shadow-sm transition-all duration-500"
            style={{
              opacity: tick >= 6 + i ? 1 : 0,
              transform: `translateY(${tick >= 6 + i ? 0 : 6}px)`,
            }}
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-purple-200" />
              <span className="text-xs font-semibold text-neutral-800">{r.name}</span>
              <span className="text-[10px] text-neutral-400">{r.tag}</span>
            </div>
            <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
              {r.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
