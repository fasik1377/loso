"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import cameraMan from "@/public/images/camera_man.jpg";
import carpenter from "@/public/images/carpenter.jpg";
import cleaner from "@/public/images/cleaner.jpg";
import dishTv from "@/public/images/dishtv.jpg";
import driver from "@/public/images/driver.jpg";
import electrician from "@/public/images/electrician.jpg";
import mason from "@/public/images/mason.jpg";
import mechanic from "@/public/images/mechanic.jpg";
import officeWorker from "@/public/images/office_worker.jpg";
import pipe from "@/public/images/pipe.jpg";
import shoes from "@/public/images/shoes.jpg";
import { cx } from "@/components/ui/primitives";

const PHOTOS: StaticImageData[] = [electrician, carpenter, officeWorker, mechanic, cleaner, driver, mason, shoes, pipe, cameraMan, dishTv];

/** Magazine-style layout on a 6×6 grid: one feature tile + five supporting tiles. */
// `fly` = where the tile flies in from on first load (x, y, rotation, flip).
const TILES = [
  { span: "col-span-4 row-span-4", depth: 6, bob: "7s", fly: ["-40%", "30%", "-8deg", "-70deg"] }, // feature
  { span: "col-span-2 row-span-2", depth: 14, bob: "6s", fly: ["90%", "-80%", "14deg", "80deg"] },
  { span: "col-span-2 row-span-2", depth: 18, bob: "8s", fly: ["110%", "10%", "-12deg", "80deg"] },
  { span: "col-span-2 row-span-2", depth: 12, bob: "6.5s", fly: ["-60%", "120%", "10deg", "-80deg"] },
  { span: "col-span-2 row-span-2", depth: 20, bob: "7.5s", fly: ["40%", "140%", "-16deg", "70deg"] },
  { span: "col-span-2 row-span-2", depth: 16, bob: "5.5s", fly: ["120%", "90%", "12deg", "80deg"] },
] as const;

/**
 * Swap transitions, used in rotation (7 is coprime with the 6 tiles, so every tile cycles
 * through all of them). `out` animates the outgoing photo for the card-flip effects.
 */
const REVEALS: { in: string; out?: string }[] = [
  { in: "mosaic-iris 1.1s cubic-bezier(0.65,0,0.35,1) both" },
  { out: "mosaic-flip-y-out 0.45s ease-in both", in: "mosaic-flip-y-in 0.55s cubic-bezier(0.2,0.8,0.2,1) 0.45s both" },
  { in: "mosaic-fly-a 1.2s cubic-bezier(0.2,0.8,0.2,1) both" },
  { in: "mosaic-slide 1s cubic-bezier(0.77,0,0.18,1) both" },
  { out: "mosaic-flip-x-out 0.45s ease-in both", in: "mosaic-flip-x-in 0.55s cubic-bezier(0.2,0.8,0.2,1) 0.45s both" },
  { in: "mosaic-focus 1.2s cubic-bezier(0.2,0.8,0.2,1) both" },
  { in: "mosaic-fly-b 1.2s cubic-bezier(0.2,0.8,0.2,1) both" },
];

/** Ken Burns drift directions, varied per photo. */
const DRIFT: [string, string][] = [
  ["1.5%", "1%"],
  ["-2%", "1%"],
  ["1%", "-2%"],
  ["-1.5%", "-1.5%"],
];

const SWAP_EVERY_MS = 2600;
// Order in which tiles change, chosen so consecutive swaps are never adjacent.
const SWAP_ORDER = [0, 4, 1, 5, 2, 3];

interface MosaicState {
  shown: number[]; // photo index per tile
  queue: number[]; // photos waiting off-screen
  prev: Record<number, number>; // last photo per tile (kept underneath during the transition)
  fx: Record<number, number>; // transition used for the tile's latest swap
  step: number;
}

/** Pure state transition: one tile swaps its photo with the next queued photo. */
function advance(s: MosaicState): MosaicState {
  const tile = SWAP_ORDER[s.step % SWAP_ORDER.length]!;
  const [incoming, ...rest] = s.queue;
  if (incoming === undefined) return s;
  const outgoing = s.shown[tile]!;
  const shown = [...s.shown];
  shown[tile] = incoming;
  return {
    shown,
    queue: [...rest, outgoing],
    prev: { ...s.prev, [tile]: outgoing },
    fx: { ...s.fx, [tile]: s.step % REVEALS.length },
    step: s.step + 1,
  };
}

/**
 * "Living mosaic": tiles fly in from scattered directions and flip into place on load, float
 * gently and tilt with the pointer (parallax). Every few seconds one tile changes photo with a
 * different transition (card flip, fly-in across the grid, iris, slide, focus pull) followed by a
 * light sweep, while each photo slowly zooms. A photo is never shown in two tiles at once.
 * Respects reduced motion.
 */
export function HeroMosaic({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<MosaicState>(() => ({
    shown: TILES.map((_, i) => i),
    queue: PHOTOS.map((_, i) => i).slice(TILES.length),
    prev: {},
    fx: {},
    step: 0,
  }));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!document.hidden) setState(advance);
    }, SWAP_EVERY_MS);
    return () => clearInterval(t);
  }, []);

  // Pointer parallax: updates CSS variables directly (no React re-render per mouse move).
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--mx", x.toFixed(3));
        el.style.setProperty("--my", y.toFixed(3));
      });
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      el.style.setProperty("--mx", "0");
      el.style.setProperty("--my", "0");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);

  const { shown, prev, fx, step } = state;
  // The tile that changed last sits on top, so photos flying in pass over their neighbours.
  const lastTile = step > 0 ? SWAP_ORDER[(step - 1) % SWAP_ORDER.length] : -1;

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className="grid h-[24rem] grid-cols-6 grid-rows-6 gap-3 transition-transform duration-500 ease-out sm:h-[30rem] lg:h-[34rem]"
      style={{
        transform: "perspective(1400px) rotateX(calc(var(--my, 0) * -4deg)) rotateY(calc(var(--mx, 0) * 5deg))",
        transformStyle: "preserve-3d",
      }}
    >
      {TILES.map((tileDef, tile) => {
        const current = shown[tile]!;
        const before = prev[tile];
        const swapped = step > 0 && before !== undefined;
        const [kbx, kby] = DRIFT[current % DRIFT.length]!;
        const reveal = REVEALS[fx[tile] ?? 0]!;
        const [flyX, flyY, flyR, flyFlip] = tileDef.fly;
        return (
          <div
            key={tile}
            className={cx(tileDef.span, "group relative transition-[translate] duration-500 ease-out", tile === lastTile && "z-10")}
            style={
              {
                animation: "mosaic-enter 1.1s cubic-bezier(0.2,0.8,0.2,1) both",
                animationDelay: `${150 + tile * 130}ms`,
                translate: `calc(var(--mx, 0) * ${-tileDef.depth}px) calc(var(--my, 0) * ${-tileDef.depth}px)`,
                "--fx": flyX,
                "--fy": flyY,
                "--fr": flyR,
                "--fflip": flyFlip,
              } as CSSProperties
            }
          >
            <div
              className={cx(
                "relative h-full w-full rounded-2xl bg-white/5 ring-1 ring-white/10 transition-shadow duration-300 group-hover:ring-gold/60",
                tile === 0 && "shadow-2xl shadow-black/30",
              )}
              style={{ animation: `mosaic-bob ${tileDef.bob} ease-in-out ${1.6 + tile * 0.4}s infinite` }}
            >
              {/* Previous photo stays underneath (or turns away, for flips) while the new one arrives. */}
              {before !== undefined && before !== current && (
                <div
                  key={`out-${before}`}
                  className="absolute inset-0 overflow-hidden rounded-2xl [backface-visibility:hidden]"
                  style={swapped && reveal.out ? { animation: reveal.out } : undefined}
                >
                  <Image src={PHOTOS[before]!} alt="" fill sizes="(min-width:1024px) 30vw, 60vw" className="object-cover" />
                </div>
              )}
              <div
                key={current}
                className="absolute inset-0 overflow-hidden rounded-2xl shadow-lg shadow-black/20 [backface-visibility:hidden]"
                style={swapped ? { animation: reveal.in } : undefined}
              >
                <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.06]">
                  <Image
                    src={PHOTOS[current]!}
                    alt=""
                    fill
                    placeholder="blur"
                    preload={step === 0 && tile === 0}
                    sizes={tile === 0 ? "(min-width:1024px) 34vw, 66vw" : "(min-width:1024px) 17vw, 33vw"}
                    className="animate-ken-burns object-cover"
                    style={{ "--kb-x": kbx, "--kb-y": kby } as CSSProperties}
                  />
                </div>
                {swapped && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent"
                    style={{ animation: "mosaic-shine 1.1s ease-out 0.75s both" }}
                  />
                )}
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-brand-deep/35 via-transparent to-transparent" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
