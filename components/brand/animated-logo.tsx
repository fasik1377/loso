import Image, { type StaticImageData } from "next/image";
import type { CSSProperties } from "react";
import hand from "@/public/images/brand/parts/hand.png";
import l1 from "@/public/images/brand/parts/l1.png";
import l2 from "@/public/images/brand/parts/l2.png";
import l3 from "@/public/images/brand/parts/l3.png";
import l4 from "@/public/images/brand/parts/l4.png";
import l5 from "@/public/images/brand/parts/l5.png";
import streaks from "@/public/images/brand/parts/streaks.png";
import tie from "@/public/images/brand/parts/tie.png";
import { cx } from "@/components/ui/primitives";

/*
 * The parts were cut from the official amber logo (public/images/logo.png) onto the same canvas,
 * so stacking them reproduces the logo exactly. Pivot points below are % of that canvas.
 */
const STREAK_ROOT = "12.6% 36.6%"; // where the speed streaks meet the hand
const TIE_KNOT = "20.5% 55.4%"; // top of the tie
const HAND_CENTRE = "18% 29.5%";
// Base centre of each letter (L, O, O, S, O), so letters bounce and scale in place.
const LETTER_BASE = ["18.4% 99%", "35% 99%", "54.8% 99%", "72.8% 99%", "91.9% 99%"];
const EASE = "cubic-bezier(0.2,0.8,0.2,1)";

function Layer({ src, style, className }: { src: StaticImageData; style?: CSSProperties; className?: string }) {
  return <Image src={src} alt="" fill unoptimized loading="eager" sizes="40rem" draggable={false} className={cx("select-none object-contain", className)} style={style} />;
}

/**
 * The Looso logo, brought to life part by part:
 *  1. the letters L-O-O-S-O pop up one after another;
 *  2. the hand flies in from the top right and lands above the "L";
 *  3. speed streaks shoot out behind it and keep flickering while it hovers;
 *  4. the tie drops from the hand, swings like a pendulum, then sways;
 *  5. a light sheen sweeps across the letters every few seconds.
 * Decorative (aria-hidden); the heading around it carries the accessible name. Motion is reduced
 * to the final pose for visitors who prefer reduced motion (global CSS rule).
 */
export function AnimatedLogo({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cx("relative block aspect-[1094/536] [filter:drop-shadow(0_10px_30px_rgb(0_0_0/0.35))]", className)}>
      {/* Letters: each one carries its own sheen (masked to its shape), so the light moves with it. */}
      {[l1, l2, l3, l4, l5].map((src, i) => (
        <span
          key={i}
          className="absolute inset-0"
          style={{
            transformOrigin: LETTER_BASE[i],
            // Entrance, then an endless wave: each letter bounces in turn every 4 seconds.
            animation: `logo-letter-in 0.7s ${EASE} ${150 + i * 90}ms both, logo-letter-wave 4s ease-in-out ${2.4 + i * 0.13}s infinite`,
          }}
        >
          <Layer src={src} />
          <span
            className="absolute inset-0"
            style={{
              maskImage: `url(${src.src})`,
              WebkitMaskImage: `url(${src.src})`,
              maskSize: "100% 100%",
              WebkitMaskSize: "100% 100%",
              // One band crossing the whole canvas: with identical timing on every letter it reads as a single sweep.
              backgroundImage: "linear-gradient(105deg, transparent 40%, rgb(255 255 255 / 0.7) 50%, transparent 60%)",
              backgroundSize: "300% 100%",
              backgroundPosition: "100% 0",
              animation: "logo-sheen 6s ease-in-out 2.6s infinite",
            }}
          />
        </span>
      ))}

      {/* Flying hand group: the hand flies in, then the whole group hovers. */}
      <span
        className="absolute inset-0"
        style={{
          transformOrigin: HAND_CENTRE,
          animation: `logo-hand-in 1s ${EASE} 0.55s both, logo-hover 3.2s ease-in-out 1.6s infinite`,
        }}
      >
        <Layer
          src={streaks}
          style={{
            transformOrigin: STREAK_ROOT,
            animation: `logo-streak-in 0.45s ${EASE} 1.3s both, logo-streak-idle 1.6s ease-in-out 1.8s infinite`,
          }}
        />
        <Layer src={hand} />
        <Layer
          src={tie}
          style={{
            transformOrigin: TIE_KNOT,
            animation: `logo-tie-drop 0.55s ${EASE} 1.35s both, logo-tie-swing 1.3s ease-in-out 1.85s both, logo-tie-sway 4s ease-in-out 3.2s infinite`,
          }}
        />
      </span>
    </span>
  );
}
