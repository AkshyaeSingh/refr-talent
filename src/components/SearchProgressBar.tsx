"use client";

import { useEffect, useRef, useState } from "react";

const STAGES = [
  "Reading your query…",
  "Shortlisting candidates…",
  "Scoring matches against your criteria…",
  "Finishing up…",
];

// A determinate-looking progress bar for a request whose real duration we
// can't know ahead of time (evaluated search makes several Claude calls).
// Fills toward ~92% while active (never claiming false completion), snaps to
// 100% and fades out the moment the real result lands, and cycles a few
// staged messages so a several-second wait reads as visible progress rather
// than a frozen page.
export default function SearchProgressBar({ active }: { active: boolean }) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const [visible, setVisible] = useState(false);
  const wasActive = useRef(false);

  useEffect(() => {
    if (active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the `active` prop turning on
      setVisible(true);
      setProgress(4);
      setStage(0);
      wasActive.current = true;

      const tick = setInterval(() => {
        // Ease toward 92%: bigger steps early, smaller as it approaches the cap.
        setProgress((p) => (p >= 92 ? p : p + Math.max(0.6, (92 - p) * 0.06)));
      }, 120);
      const stageTick = setInterval(() => {
        setStage((s) => Math.min(s + 1, STAGES.length - 1));
      }, 1600);

      return () => {
        clearInterval(tick);
        clearInterval(stageTick);
      };
    }

    if (wasActive.current) {
      // Snap to done, then fade out.
      setProgress(100);
      const hide = setTimeout(() => setVisible(false), 350);
      wasActive.current = false;
      return () => clearTimeout(hide);
    }
  }, [active]);

  if (!visible) return null;

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="h-1 w-full overflow-hidden rounded-full bg-purple-100">
        <div
          className="h-full rounded-full bg-purple-600 transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      {active && <p className="text-xs text-neutral-400">✨ {STAGES[stage]}</p>}
    </div>
  );
}
