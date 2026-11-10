import type { CSSProperties } from "react";
import {
  Briefcase,
  Camera,
  Car,
  Hammer,
  HardHat,
  Laptop,
  Paintbrush,
  Ruler,
  Scissors,
  Truck,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cx } from "@/components/ui/primitives";

/** Deterministic "sparks" (no randomness, so server and client render the same markup). */
const SPARKS = [
  { left: 6, bottom: 4, delay: 0, dur: 9, size: 4, dx: 30 },
  { left: 14, bottom: 18, delay: 3.5, dur: 11, size: 3, dx: -20 },
  { left: 23, bottom: 2, delay: 6, dur: 10, size: 5, dx: 24 },
  { left: 31, bottom: 12, delay: 1.5, dur: 12, size: 3, dx: -30 },
  { left: 42, bottom: 6, delay: 7.5, dur: 9.5, size: 4, dx: 18 },
  { left: 51, bottom: 20, delay: 4, dur: 11.5, size: 3, dx: -14 },
  { left: 60, bottom: 3, delay: 2.5, dur: 10.5, size: 5, dx: 26 },
  { left: 69, bottom: 14, delay: 8.5, dur: 12, size: 3, dx: -22 },
  { left: 77, bottom: 5, delay: 5, dur: 9, size: 4, dx: 16 },
  { left: 85, bottom: 16, delay: 0.8, dur: 11, size: 3, dx: -26 },
  { left: 93, bottom: 8, delay: 6.8, dur: 10, size: 4, dx: 12 },
  { left: 47, bottom: 30, delay: 9.5, dur: 13, size: 2, dx: 20 },
];

/** Rings of the circular backdrop: diameter, turn time, direction, and the trade icons riding on them. */
const ORBITS: {
  size: string;
  seconds: number;
  reverse?: boolean;
  icons: LucideIcon[];
}[] = [
  { size: "min(26rem, 80vw)", seconds: 70, icons: [Wrench, Briefcase, Zap] },
  {
    size: "min(42rem, 120vw)",
    seconds: 100,
    reverse: true,
    icons: [Hammer, Laptop, Truck, Paintbrush],
  },
  {
    size: "min(60rem, 170vw)",
    seconds: 140,
    icons: [HardHat, Camera, Scissors, Car, Ruler],
  },
];

/** Concentric turning rings carrying job/trade icons (icons stay upright), with ripples from the centre. */
function Orbits({ center }: { center: string }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        maskImage:
          "radial-gradient(ellipse 75% 75% at 60% 50%, black 40%, transparent 85%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 75% 75% at 60% 50%, black 40%, transparent 85%)",
      }}
    >
      <div className="absolute" style={{ left: center, top: "50%" }}>
        {/* Ripples spreading outwards */}
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute left-0 top-0 rounded-full border border-gold/25"
            style={{
              width: "min(60rem, 170vw)",
              height: "min(60rem, 170vw)",
              animation: `orbit-ripple 9s ease-out ${i * 3}s infinite both`,
            }}
          />
        ))}
        {/* Glow at the centre */}
        <span className="absolute left-0 top-0 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/15 blur-3xl" />
        {ORBITS.map((o, ring) => {
          const turn = `orbit-turn ${o.seconds}s linear infinite${o.reverse ? " reverse" : ""}`;
          const counter = `orbit-turn ${o.seconds}s linear infinite${o.reverse ? "" : " reverse"}`;
          return (
            <div
              key={ring}
              className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2"
              style={{ width: o.size, height: o.size }}
            >
              <div
                className="relative h-full w-full rounded-full border border-dashed border-white/[0.09]"
                style={{ animation: turn }}
              >
                {o.icons.map((Icon, i) => {
                  const angle = (360 / o.icons.length) * i + ring * 25;
                  return (
                    <div
                      key={i}
                      className="absolute inset-0"
                      style={{ transform: `rotate(${angle}deg)` }}
                    >
                      <span
                        className="absolute left-1/2 top-0"
                        style={{
                          transform: `translate(-50%, -50%) rotate(${-angle}deg)`,
                        }}
                      >
                        <span
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-gold/70 ring-1 ring-white/15 backdrop-blur-sm"
                          style={{ animation: counter }}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Soft, slow, purely decorative motion layer: drifting aurora light, a gently panning grid,
 * rising sparks and (on dark surfaces) an occasional light beam. Pure CSS; hidden from
 * assistive tech; frozen for visitors who prefer reduced motion (global rule in globals.css).
 * Place inside a `relative overflow-hidden` container, before the content.
 */
export function AnimatedBackdrop({
  tone = "dark",
  sparks = true,
  pattern = "grid",
  orbitCenter = "50%",
  className,
}: {
  tone?: "dark" | "light";
  sparks?: boolean;
  /** "grid": panning square grid. "orbits": turning rings with job icons (centred at `orbitCenter`). */
  pattern?: "grid" | "orbits";
  orbitCenter?: string;
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <div
      aria-hidden="true"
      className={cx(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      {/* Aurora light */}
      <div
        className={cx(
          "absolute -left-[10%] -top-[30%] h-[70%] w-[55%] rounded-full blur-3xl",
          dark ? "bg-gold/20" : "bg-gold/15",
        )}
        style={{ animation: "aurora-a 22s ease-in-out infinite" }}
      />
      <div
        className={cx(
          "absolute -right-[15%] top-[10%] h-[80%] w-[60%] rounded-full blur-3xl",
          dark ? "bg-sky-400/20" : "bg-brand/10",
        )}
        style={{ animation: "aurora-b 26s ease-in-out infinite" }}
      />
      <div
        className={cx(
          "absolute -bottom-[35%] left-[25%] h-[70%] w-[50%] rounded-full blur-3xl",
          dark ? "bg-emerald-400/15" : "bg-success/10",
        )}
        style={{ animation: "aurora-c 30s ease-in-out infinite" }}
      />

      {pattern === "orbits" && <Orbits center={orbitCenter} />}

      {/* Panning grid, faded towards the edges */}
      {pattern === "grid" && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${dark ? "rgb(255 255 255 / 0.05)" : "rgb(24 43 67 / 0.05)"} 1px, transparent 1px), linear-gradient(90deg, ${dark ? "rgb(255 255 255 / 0.05)" : "rgb(24 43 67 / 0.05)"} 1px, transparent 1px)`,
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 75%)",
            animation: "grid-pan 14s linear infinite",
          }}
        />
      )}

      {/* Light beam sweeping across (dark surfaces only) */}
      {dark && (
        <div
          className="absolute -top-1/2 left-0 h-[200%] w-1/4 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
          style={{ animation: "beam-sweep 11s ease-in-out 2s infinite" }}
        />
      )}

      {/* Rising sparks */}
      {sparks &&
        SPARKS.map((s, i) => (
          <span
            key={i}
            className={cx(
              "absolute rounded-full",
              dark
                ? i % 3 === 0
                  ? "bg-white/70"
                  : "bg-gold/80"
                : i % 3 === 0
                  ? "bg-brand/30"
                  : "bg-gold/60",
            )}
            style={
              {
                left: `${s.left}%`,
                bottom: `${s.bottom}%`,
                width: s.size,
                height: s.size,
                boxShadow: dark
                  ? "0 0 10px 2px rgb(244 185 66 / 0.35)"
                  : undefined,
                animation: `spark-rise ${s.dur}s ease-in ${s.delay}s infinite both`,
                "--dx": `${s.dx}px`,
              } as CSSProperties
            }
          />
        ))}
    </div>
  );
}
