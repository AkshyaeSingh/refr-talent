"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type Simulation,
} from "d3-force";

const W = 1000;
const H = 680;

type ApiNode = {
  id: string;
  name: string;
  poolSize: number;
  sent: number;
  received: number;
  category: "source" | "balanced" | "receiver";
  isMe: boolean;
};
type ApiEdge = { source: string; target: string; count: number };

type SimNode = ApiNode & { x: number; y: number; vx: number; vy: number; r: number };
type SimLink = { source: SimNode; target: SimNode; count: number };

const COLORS: Record<ApiNode["category"], string> = {
  source: "#a855f7",
  balanced: "#3b82f6",
  receiver: "#f97316",
};

function radius(poolSize: number) {
  return Math.min(46, 16 + Math.sqrt(poolSize) * 4);
}

export default function JourneyPage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  const [hover, setHover] = useState<SimNode | null>(null);
  const [empty, setEmpty] = useState(false);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);

  useEffect(() => {
    let stopped = false;
    fetch("/api/network")
      .then((r) => r.json())
      .then((data: { nodes: ApiNode[]; edges: ApiEdge[] }) => {
        if (stopped) return;
        if (!data.nodes || data.nodes.length === 0) {
          setEmpty(true);
          return;
        }
        const simNodes: SimNode[] = data.nodes.map((n, i) => ({
          ...n,
          r: radius(n.poolSize),
          x: W / 2 + Math.cos((i / data.nodes.length) * Math.PI * 2) * 200,
          y: H / 2 + Math.sin((i / data.nodes.length) * Math.PI * 2) * 200,
          vx: 0,
          vy: 0,
        }));
        const byId = new Map(simNodes.map((n) => [n.id, n]));
        const simLinks: SimLink[] = data.edges
          .filter((e) => byId.has(e.source) && byId.has(e.target))
          .map((e) => ({
            source: byId.get(e.source)!,
            target: byId.get(e.target)!,
            count: e.count,
          }));

        const sim = forceSimulation(simNodes)
          .force("charge", forceManyBody().strength(-450))
          .force(
            "link",
            forceLink<SimNode, SimLink>(simLinks)
              .id((d) => d.id)
              .distance(140)
              .strength(0.2)
          )
          .force("center", forceCenter(W / 2, H / 2))
          .force("collide", forceCollide<SimNode>().radius((d) => d.r + 10))
          .alpha(1)
          .alphaDecay(0.03);

        sim.on("tick", () => {
          setNodes([...simNodes]);
          setLinks([...simLinks]);
        });
        simRef.current = sim;
      });

    return () => {
      stopped = true;
      simRef.current?.stop();
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <div className="px-6 pt-6">
        <h1 className="text-2xl font-bold">Talent Journey</h1>
        <p className="text-sm text-neutral-500">
          How talent flows across the network. Each node is an org, sized by pool. Arrows follow
          candidates shared from one org to another.
        </p>
      </div>

      {/* Legend */}
      <div className="absolute left-6 top-32 z-10 rounded-xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur">
        <div className="mb-2 text-xs font-semibold text-neutral-700">Talent flow</div>
        <LegendRow color={COLORS.source} label="Net source (shares out)" />
        <LegendRow color={COLORS.balanced} label="Balanced" />
        <LegendRow color={COLORS.receiver} label="Net receiver (pulls in)" />
        <div className="mt-2 border-t border-neutral-100 pt-2 text-[11px] text-neutral-400">
          Ringed node = your org
        </div>
      </div>

      {empty && (
        <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
          No orgs in the network yet.
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="h-[calc(100%-1rem)] w-full">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="#94a3b8" />
          </marker>
        </defs>

        {/* Edges */}
        {links.map((l, i) => (
          <line
            key={i}
            x1={l.source.x}
            y1={l.source.y}
            x2={l.target.x}
            y2={l.target.y}
            stroke="#94a3b8"
            strokeOpacity={0.35}
            strokeWidth={Math.min(4, 1 + l.count / 3)}
            markerEnd="url(#arrow)"
          />
        ))}

        {/* Nodes */}
        {nodes.map((n) => {
          const color = COLORS[n.category];
          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(null)}
              onClick={() => router.push("/dashboard")}
              className="cursor-pointer"
            >
              {/* glow halo */}
              <circle r={n.r + 8} fill={color} opacity={0.12} />
              <circle r={n.r + 3} fill="none" stroke={color} strokeOpacity={0.4} strokeWidth={2} />
              <circle r={n.r} fill="#ffffff" stroke={color} strokeWidth={n.isMe ? 4 : 2} />
              {n.isMe && (
                <circle r={n.r + 7} fill="none" stroke="#171717" strokeOpacity={0.6} strokeWidth={1.5} />
              )}
              <text
                textAnchor="middle"
                dy="0.35em"
                fontSize={Math.max(10, n.r * 0.55)}
                fontWeight={700}
                fill="#171717"
              >
                {n.name.slice(0, 2).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-lg"
          style={{
            left: `${(hover.x / W) * 100}%`,
            top: `${(hover.y / H) * 100}%`,
            transform: "translate(-50%, -140%)",
          }}
        >
          <div className="font-semibold">
            {hover.name}
            {hover.isMe ? " (you)" : ""}
          </div>
          <div className="text-neutral-600">{hover.poolSize} in pool</div>
          <div className="text-neutral-500">
            ↗ shared out {hover.sent} · ↘ pulled in {hover.received}
          </div>
        </div>
      )}
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-xs text-neutral-600">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}
