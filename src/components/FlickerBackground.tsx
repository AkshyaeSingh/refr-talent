"use client";

import { FlickeringGrid } from "@/components/ui/flickering-grid";

// Shared decorative background for auth/onboarding/public pages, replacing the
// old static contour-line SVG with the same flickering-grid texture used on
// the marketing landing page — kept slow so it stays quiet background texture.
//
// - "vignette": full-bleed, faded from the center outward (the old contour
//   background's look) — used behind a centered card.
// - "diagonal-left": texture concentrated in the upper-left, fading out along
//   a diagonal toward the bottom-right — used on the login page.
export default function FlickerBackground({
  variant = "vignette",
}: {
  variant?: "vignette" | "diagonal-left";
}) {
  if (variant === "diagonal-left") {
    return (
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-white">
        <div className="absolute -left-32 -top-32 h-[900px] w-[900px] [mask-image:linear-gradient(to_bottom_right,black_0%,black_38%,transparent_68%)]">
          <FlickeringGrid
            className="size-full"
            squareSize={4}
            gridGap={6}
            color="#52525b"
            maxOpacity={0.34}
            flickerChance={0.04}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-white">
      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]">
        <FlickeringGrid
          className="size-full"
          squareSize={4}
          gridGap={6}
          color="#52525b"
          maxOpacity={0.3}
          flickerChance={0.042}
        />
      </div>
    </div>
  );
}
