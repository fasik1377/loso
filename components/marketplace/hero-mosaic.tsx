"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useState } from "react";
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
const TILES = [
  "col-span-4 row-span-4", // feature
  "col-span-2 row-span-2",
  "col-span-2 row-span-2",
  "col-span-2 row-span-2",
  "col-span-2 row-span-2",
  "col-span-2 row-span-2",
];

const SWAP_EVERY_MS = 2200;
// Order in which tiles change, chosen so consecutive swaps are never adjacent.
const SWAP_ORDER = [0, 4, 1, 5, 2, 3];

interface MosaicState {
  shown: number[]; // photo index per tile
  queue: number[]; // photos waiting off-screen
  prev: Record<number, number>; // last photo per tile (kept underneath during the wipe)
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
  return { shown, queue: [...rest, outgoing], prev: { ...s.prev, [tile]: outgoing }, step: s.step + 1 };
}

/**
 * "Living mosaic": every couple of seconds one tile wipes to a new photo while each photo
 * slowly zooms. A photo is never shown in two tiles at once. Respects reduced motion.
 */
export function HeroMosaic({ label }: { label: string }) {
  const [state, setState] = useState<MosaicState>(() => ({
    shown: TILES.map((_, i) => i),
    queue: PHOTOS.map((_, i) => i).slice(TILES.length),
    prev: {},
    step: 0,
  }));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!document.hidden) setState(advance);
    }, SWAP_EVERY_MS);
    return () => clearInterval(t);
  }, []);

  const { shown, prev, step } = state;

  return (
    <div role="img" aria-label={label} className="grid h-[24rem] grid-cols-6 grid-rows-6 gap-3 sm:h-[30rem] lg:h-[34rem]">
      {TILES.map((span, tile) => {
        const current = shown[tile]!;
        const before = prev[tile];
        return (
          <div
            key={tile}
            className={cx(
              span,
              "relative overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10",
              tile === 0 && "shadow-2xl shadow-black/30",
            )}
          >
            {/* Previous photo stays underneath while the new one wipes in. */}
            {before !== undefined && before !== current && (
              <Image src={PHOTOS[before]!} alt="" fill sizes="(min-width:1024px) 30vw, 60vw" className="object-cover" />
            )}
            <div key={current} className={cx("absolute inset-0", step > 0 && before !== undefined && "animate-tile-reveal")}>
              <Image
                src={PHOTOS[current]!}
                alt=""
                fill
                placeholder="blur"
                preload={step === 0 && tile === 0}
                sizes={tile === 0 ? "(min-width:1024px) 34vw, 66vw" : "(min-width:1024px) 17vw, 33vw"}
                className="animate-ken-burns object-cover"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-brand-deep/35 via-transparent to-transparent" />
          </div>
        );
      })}
    </div>
  );
}
