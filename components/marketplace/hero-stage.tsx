"use client";

import Image, { type StaticImageData } from "next/image";
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import cameraMan from "@/public/images/camera_man.jpg";
import carpenter from "@/public/images/carpenter.jpg";
import cleaner from "@/public/images/cleaner.jpg";
import dishTv from "@/public/images/dishtv.jpg";
import driver from "@/public/images/driver.jpg";
import electrician from "@/public/images/electrician.jpg";
import makeupArtist from "@/public/images/makeup_artist.jpg";
import mason from "@/public/images/mason.jpg";
import mechanic from "@/public/images/mechanic.jpg";
import officeWorker from "@/public/images/office_worker.jpg";
import painting from "@/public/images/painting.jpg";
import phoneFixer from "@/public/images/phone_fixer.jpg";
import pipe from "@/public/images/pipe.jpg";
import shoes from "@/public/images/shoes.jpg";
import { cx } from "@/components/ui/primitives";

/** Caption keys match `hero.photos` in the dictionaries. `focus` = object-position for full-bleed crops. */
export type SceneKey =
  | "makeupArtist"
  | "electrician"
  | "phoneRepair"
  | "carpenter"
  | "painter"
  | "mechanic"
  | "officeWorker"
  | "driver"
  | "cleaner"
  | "mason"
  | "plumber"
  | "photographer"
  | "satellite"
  | "shoeShiner";

const SCENES: { key: SceneKey; src: StaticImageData; focus?: string }[] = [
  { key: "makeupArtist", src: makeupArtist, focus: "70% 50%" },
  { key: "electrician", src: electrician },
  { key: "phoneRepair", src: phoneFixer, focus: "50% 55%" },
  { key: "carpenter", src: carpenter },
  { key: "painter", src: painting, focus: "45% 50%" },
  { key: "mechanic", src: mechanic },
  { key: "officeWorker", src: officeWorker },
  { key: "driver", src: driver },
  { key: "cleaner", src: cleaner },
  { key: "mason", src: mason },
  { key: "plumber", src: pipe },
  { key: "photographer", src: cameraMan },
  { key: "satellite", src: dishTv },
  { key: "shoeShiner", src: shoes },
];

const SCENE_MS = 3000;
const SLICES = 6;

interface StageState {
  index: number;
  prev: number | null;
  n: number; // increments on every change (re-keys the animations)
}

const StageCtx = createContext<{ state: StageState; go: (i: number) => void; auto: boolean } | null>(null);

function useStage() {
  const ctx = useContext(StageCtx);
  if (!ctx) throw new Error("Hero stage components must be inside <HeroStageProvider>.");
  return ctx;
}

const noopSubscribe = () => () => {};

/** Owns the current scene and the auto-advance timer; the photo layer and caption read from it. */
export function HeroStageProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StageState>({ index: 0, prev: null, n: 0 });
  const [rearm, setRearm] = useState(0);
  // True once hydrated: the slideshow always advances on its own. For visitors who prefer
  // reduced motion the global CSS rule turns the transitions into simple cuts.
  const auto = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const go = useCallback((i: number) => {
    setState((s) => (i === s.index ? s : { index: i, prev: s.index, n: s.n + 1 }));
  }, []);

  // Restart the timer after every change, so a manual jump gets a full scene too.
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => {
      if (document.hidden) setRearm((r) => r + 1); // wait while the tab is in the background
      else go((state.index + 1) % SCENES.length);
    }, SCENE_MS);
    return () => clearTimeout(t);
  }, [auto, state.index, rearm, go]);

  return <StageCtx.Provider value={{ state, go, auto }}>{children}</StageCtx.Provider>;
}

/** Signature transitions, used in turn so no two consecutive changes look alike. */
const TRANSITIONS = ["blade", "iris", "doors", "warp", "shutter"] as const;
type Transition = (typeof TRANSITIONS)[number];
const EASE = "cubic-bezier(0.83,0,0.17,1)";
const DUR = "0.95s";

type Scene = (typeof SCENES)[number];

/** One full-bleed photo; `zoom` adds the slow Ken Burns push-in. */
function SceneImage({ scene, zoom, first }: { scene: Scene; zoom?: string; first?: boolean }) {
  return (
    <Image
      src={scene.src}
      alt=""
      fill
      preload={first}
      placeholder={first ? "blur" : undefined}
      sizes="100vw"
      className="object-cover"
      style={{ objectPosition: scene.focus, animation: zoom }}
    />
  );
}

/**
 * Full-bleed photo layer. Each change uses the next signature transition:
 *  - blade:   a slanted cut slashes across the screen, led by a gold edge
 *  - iris:    the new scene bursts open from a glowing gold circle
 *  - doors:   the old scene splits down the middle and both halves slide away
 *  - warp:    the new scene streaks in at light speed, pushing the old one away
 *  - shutter: vertical slices slide in from alternate directions, gold-edged
 * Every photo slowly pushes in (Ken Burns). Reduced motion: the global CSS rule makes these cuts.
 */
export function StagePhotos({ label }: { label: string }) {
  const { state } = useStage();
  const scene = SCENES[state.index]!;
  const prev = state.prev !== null ? SCENES[state.prev]! : null;
  // With short scenes, warm the cache two photos ahead.
  const upcoming = [1, 2].map((k) => SCENES[(state.index + k) % SCENES.length]!);
  const zoom = `ken-burns ${SCENE_MS / 1000 + 1.5}s ease-out both`;
  const fx: Transition = TRANSITIONS[(state.n - 1 + TRANSITIONS.length) % TRANSITIONS.length]!;
  const k = state.n; // re-keys every layer so each change replays its animation

  let layers: ReactNode;
  if (state.n === 0 || !prev) {
    layers = <SceneImage scene={scene} zoom={zoom} first />;
  } else if (fx === "blade" || fx === "iris") {
    const [wipe, glow] = fx === "blade" ? ["blade-wipe", "blade-glow"] : ["iris-open", "iris-glow"];
    layers = (
      <>
        <SceneImage key={`p${k}`} scene={prev} />
        {/* Gold layer running a hair ahead of the photo = a glowing leading edge. */}
        <div key={`g${k}`} aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-gold via-amber-200 to-gold" style={{ animation: `${glow} ${DUR} ${EASE} both` }} />
        <div key={`n${k}`} className="absolute inset-0" style={{ animation: `${wipe} ${DUR} ${EASE} both` }}>
          <div className="absolute inset-0" style={fx === "iris" ? { animation: `focus-in 1.2s cubic-bezier(0.2,0.8,0.2,1) both` } : undefined}>
            <SceneImage scene={scene} zoom={zoom} />
          </div>
        </div>
      </>
    );
  } else if (fx === "doors") {
    layers = (
      <>
        <div key={`n${k}`} className="absolute inset-0" style={{ animation: "focus-in 1.3s cubic-bezier(0.2,0.8,0.2,1) both" }}>
          <SceneImage scene={scene} zoom={zoom} />
        </div>
        {(["left", "right"] as const).map((side) => (
          <div
            key={`${side}${k}`}
            className="absolute inset-0 shadow-[0_0_60px_rgb(0_0_0/0.6)]"
            style={{
              clipPath: side === "left" ? "inset(0 50% 0 0)" : "inset(0 0 0 50%)",
              animation: `door-${side} 1.05s ${EASE} 0.1s both`,
            }}
          >
            <SceneImage scene={prev} />
            {/* Gold seam along the split. */}
            <span aria-hidden="true" className={cx("absolute inset-y-0 w-[3px] bg-gold shadow-[0_0_20px_6px_rgb(244_185_66/0.6)]", side === "left" ? "left-[calc(50%-3px)]" : "left-1/2")} />
          </div>
        ))}
      </>
    );
  } else if (fx === "warp") {
    layers = (
      <>
        <div key={`p${k}`} className="absolute inset-0 origin-left" style={{ animation: `warp-out ${DUR} ${EASE} both` }}>
          <SceneImage scene={prev} />
        </div>
        <div key={`n${k}`} className="absolute inset-0 origin-left" style={{ animation: `warp-in ${DUR} ${EASE} both` }}>
          <SceneImage scene={scene} zoom={zoom} />
        </div>
      </>
    );
  } else {
    layers = (
      <>
        <SceneImage key={`p${k}`} scene={prev} />
        {Array.from({ length: SLICES }, (_, i) => {
          const left = (i * 100) / SLICES;
          const right = 100 - ((i + 1) * 100) / SLICES;
          const fromBelow = i % 2 === 0;
          const delay = `${i * 60}ms`;
          return (
            <div
              key={`${k}-${i}`}
              className="absolute inset-0"
              style={{
                // Slightly overlapping slices avoid hairline gaps between them.
                clipPath: `inset(0 ${Math.max(0, right - 0.15)}% 0 ${Math.max(0, left - 0.15)}%)`,
                animation: `${fromBelow ? "shutter-up" : "shutter-down"} 0.85s cubic-bezier(0.76,0,0.24,1) ${delay} both`,
              }}
            >
              <SceneImage scene={scene} zoom={zoom} />
              {/* Gold edge of light on the slice's leading side. */}
              <span
                aria-hidden="true"
                className={cx("absolute inset-x-0 h-[3px] bg-gold shadow-[0_0_18px_4px_rgb(244_185_66/0.55)]", fromBelow ? "top-0" : "bottom-0")}
                style={{ animation: `stage-flash 0.85s ease-out ${delay} both` }}
              />
            </div>
          );
        })}
      </>
    );
  }

  return (
    <div role="img" aria-label={label} className="absolute inset-0 overflow-hidden bg-brand-deep">
      {layers}

      {state.n > 0 && (
        <div
          key={`flash-${k}`}
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-gold/20 via-transparent to-transparent mix-blend-screen"
          style={{ animation: "stage-flash 0.9s ease-out 0.3s both" }}
        />
      )}

      {/* Warm the cache for the next scenes. */}
      {upcoming.map((u) => (
        <Image key={u.key} src={u.src} alt="" fill sizes="100vw" loading="eager" className="pointer-events-none object-cover opacity-0" aria-hidden="true" />
      ))}
    </div>
  );
}

/** Names the trade on screen, with a story-style progress bar you can click to jump to any scene. */
export function StageCaption({ labels, sceneLabel, className }: { labels: Record<SceneKey, string>; sceneLabel: string; className?: string }) {
  const { state, go, auto } = useStage();
  const scene = SCENES[state.index]!;
  return (
    <div className={cx("text-white", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/55">
        {sceneLabel} · <span className="tabular-nums">{String(state.index + 1).padStart(2, "0")}</span>
        <span className="text-white/35"> / {String(SCENES.length).padStart(2, "0")}</span>
      </p>
      <div className="mt-1 overflow-hidden" aria-live="polite">
        <p key={state.n} className="font-display text-2xl font-bold tracking-tight sm:text-3xl" style={{ animation: "rise-in 0.6s cubic-bezier(0.2,0.8,0.2,1) 0.25s both" }}>
          {labels[scene.key]}
        </p>
      </div>
      <div className="mt-3 flex gap-1">
        {SCENES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => go(i)}
            aria-label={labels[s.key]}
            aria-current={i === state.index ? "true" : undefined}
            className="group relative h-6 flex-1 cursor-pointer"
          >
            <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/20 transition-colors group-hover:bg-white/40">
              {i < state.index && <span className="absolute inset-0 bg-white/70" />}
              {i === state.index && (
                <span
                  key={state.n}
                  className="absolute inset-0 origin-left bg-gold"
                  style={auto ? { animation: `progress-fill ${SCENE_MS}ms linear both` } : undefined}
                />
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
