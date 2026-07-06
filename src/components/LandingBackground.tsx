"use client";

import { FlickeringGrid } from "@/components/ui/flickering-grid";

// Decorative background for the marketing landing page: a few flickering-grid
// panels (top-left plus a couple of other segments), kept slow and low-opacity
// so they read as quiet ambient texture rather than something demanding
// attention. Each panel is radially masked so it fades into the page instead of
// showing a hard edge. Purely decorative; pointer-events disabled.
export default function LandingBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-white">
      {/* Top-left — the primary accent */}
      <div className="absolute -left-24 -top-24 h-[460px] w-[560px] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_72%)]">
        <FlickeringGrid
          className="size-full"
          squareSize={4}
          gridGap={7}
          color="#71717a"
          maxOpacity={0.18}
          flickerChance={0.045}
        />
      </div>

      {/* Bottom-right segment */}
      <div className="absolute -bottom-28 -right-20 h-[420px] w-[500px] [mask-image:radial-gradient(ellipse_at_bottom_right,black,transparent_72%)]">
        <FlickeringGrid
          className="size-full"
          squareSize={4}
          gridGap={7}
          color="#71717a"
          maxOpacity={0.14}
          flickerChance={0.04}
        />
      </div>

      {/* Mid-right accent (upper) */}
      <div className="absolute right-[6%] top-[26%] hidden h-[240px] w-[280px] [mask-image:radial-gradient(ellipse,black,transparent_70%)] lg:block">
        <FlickeringGrid
          className="size-full"
          squareSize={4}
          gridGap={7}
          color="#71717a"
          maxOpacity={0.12}
          flickerChance={0.035}
        />
      </div>

      {/* Mid-right accent (lower) */}
      <div className="absolute right-[10%] top-[56%] hidden h-[220px] w-[260px] [mask-image:radial-gradient(ellipse,black,transparent_70%)] lg:block">
        <FlickeringGrid
          className="size-full"
          squareSize={4}
          gridGap={7}
          color="#71717a"
          maxOpacity={0.12}
          flickerChance={0.035}
        />
      </div>
    </div>
  );
}
