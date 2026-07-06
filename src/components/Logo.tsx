// Simple Refr wordmark: a minimal "referral" mark (one node passing to another)
// plus the name. Kept intentionally plain so it reads at any size.
export default function Logo({
  size = 22,
  showWord = true,
  color = "#9333ea",
}: {
  size?: number;
  showWord?: boolean;
  color?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2" style={{ lineHeight: 1 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ display: "block" }}
      >
        <circle cx="5" cy="18.5" r="2.6" fill={color} />
        <path
          d="M6.5 16.5 Q 10 7.5 16 6"
          stroke={color}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M16.4 6 l-3.4 0.2 M16.4 6 l-1.2 3.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <circle cx="18.5" cy="5.5" r="2.6" fill={color} />
      </svg>
      {showWord && (
        <span
          className="font-bold tracking-tight text-neutral-900"
          style={{ fontSize: size * 0.9 }}
        >
          Refr
        </span>
      )}
    </span>
  );
}
