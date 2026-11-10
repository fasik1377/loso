"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useState } from "react";
import carpenter from "@/public/images/carpenter.jpg";
import electrician from "@/public/images/electrician.jpg";
import mechanic from "@/public/images/mechanic.jpg";
import officeWorker from "@/public/images/office_worker.jpg";
import cleaner from "@/public/images/cleaner.jpg";
import driver from "@/public/images/driver.jpg";

const PHOTOS: StaticImageData[] = [electrician, officeWorker, carpenter, cleaner, mechanic, driver];

/** Resting pose for the top three cards of the stack (front first). */
const POSES = [
  "translate3d(0,0,0) rotate(0deg) scale(1)",
  "translate3d(-9%,5%,0) rotate(-7deg) scale(0.93)",
  "translate3d(9%,9%,0) rotate(7deg) scale(0.86)",
];

const EVERY_MS = 3200;

/**
 * A fanned deck of work photos: every few seconds the front card flies off and the cards
 * behind glide forward. Decorative only. Static for visitors who prefer reduced motion.
 */
export function PhotoDeck({ className }: { className?: string }) {
  const [state, setState] = useState({ order: PHOTOS.map((_, i) => i), leaving: null as number | null, tick: 0 });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (document.hidden) return;
      setState((s) => ({ order: [...s.order.slice(1), s.order[0]!], leaving: s.order[0]!, tick: s.tick + 1 }));
    }, EVERY_MS);
    return () => clearInterval(t);
  }, []);

  const visible = state.order.slice(0, POSES.length);

  return (
    <div aria-hidden="true" className={className}>
      <div className="relative aspect-[4/5] w-full">
        {/* Back to front, so the front card paints last. */}
        {[...visible].reverse().map((photo) => {
          const pos = visible.indexOf(photo);
          return (
            <div
              key={photo}
              className="absolute inset-0 overflow-hidden rounded-3xl shadow-2xl shadow-black/40 ring-1 ring-white/15 transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
              style={{ transform: POSES[pos], opacity: pos === 2 ? 0.75 : 1 }}
            >
              <Image src={PHOTOS[photo]!} alt="" fill placeholder="blur" sizes="(min-width:1024px) 22vw, 60vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-deep/50 via-transparent to-transparent" />
            </div>
          );
        })}
        {state.leaving !== null && (
          <div
            key={`leave-${state.tick}`}
            className="absolute inset-0 overflow-hidden rounded-3xl shadow-2xl shadow-black/40 ring-1 ring-white/15"
            style={{ animation: "card-fly-out 0.8s cubic-bezier(0.55,0,0.7,0.2) both" }}
          >
            <Image src={PHOTOS[state.leaving]!} alt="" fill sizes="(min-width:1024px) 22vw, 60vw" className="object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}
