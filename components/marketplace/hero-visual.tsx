"use client";

import { useEffect, useState } from "react";
import { Briefcase, Hammer, Laptop, Scissors, Truck, Users, Wrench, Zap, type LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";

/*
 * "Skills connecting across Hawassa" — an original, text-free illustration:
 * a constellation of skills whose light pulses flow into the Loso hub, rising like the sun
 * over the waves of Lake Hawassa. Pure SVG/CSS; decorative for assistive tech.
 */

const SIZE = 520;
const HUB = { x: 260, y: 236 };

const NODES: { x: number; y: number; icon: LucideIcon; delay: number }[] = [
  { x: 96, y: 118, icon: Zap, delay: 0 },
  { x: 248, y: 56, icon: Briefcase, delay: 0.8 },
  { x: 410, y: 96, icon: Wrench, delay: 1.6 },
  { x: 470, y: 238, icon: Laptop, delay: 0.4 },
  { x: 408, y: 362, icon: Hammer, delay: 1.2 },
  { x: 262, y: 398, icon: Users, delay: 2 },
  { x: 108, y: 356, icon: Scissors, delay: 0.6 },
  { x: 50, y: 230, icon: Truck, delay: 1.4 },
];

/** Gentle curve from a node to the hub (control point pulled toward the centre). */
function curve(n: { x: number; y: number }) {
  const cx = (n.x + HUB.x) / 2 + (HUB.y - n.y) * 0.18;
  const cy = (n.y + HUB.y) / 2 + (n.x - HUB.x) * 0.18;
  return `M${n.x},${n.y} Q${cx.toFixed(1)},${cy.toFixed(1)} ${HUB.x},${HUB.y}`;
}

const WAVE = (y: number, amp: number) => {
  // Two periods wide so it can slide left seamlessly.
  let d = `M0,${y}`;
  for (let i = 0; i < 8; i++) d += ` q65,${i % 2 ? amp : -amp} 130,0`;
  return d;
};

export function HeroVisual() {
  // SMIL animations ignore the CSS reduced-motion rule, so check the preference explicitly.
  const [motion, setMotion] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotion(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[520px] select-none">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <radialGradient id="loso-sun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F4B942" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#F4B942" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#F4B942" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="loso-line" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#F4B942" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="loso-lake" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#7DD3FC" stopOpacity="0" />
          </linearGradient>
          <clipPath id="loso-frame">
            <rect x="0" y="0" width={SIZE} height={SIZE} rx="40" />
          </clipPath>
        </defs>

        {/* Sunrise glow behind the hub */}
        <circle cx={HUB.x} cy={HUB.y} r="210" fill="url(#loso-sun)" />

        {/* Orbit rings */}
        <circle cx={HUB.x} cy={HUB.y} r="92" fill="none" stroke="#FFFFFF" strokeOpacity="0.1" />
        <circle
          cx={HUB.x}
          cy={HUB.y}
          r="120"
          fill="none"
          stroke="#F4B942"
          strokeOpacity="0.45"
          strokeDasharray="2 10"
          strokeLinecap="round"
          className="origin-center animate-orbit [transform-box:fill-box]"
        />
        <circle cx={HUB.x} cy={HUB.y} r="178" fill="none" stroke="#FFFFFF" strokeOpacity="0.06" strokeDasharray="1 6" />

        {/* Constellation (links + travelling light) slowly orbits the hub */}
        <g className="animate-constellation" style={{ transformOrigin: `${HUB.x}px ${HUB.y}px`, transformBox: "view-box" }}>
        {NODES.map((n, i) => {
          const m = NODES[(i + 1) % NODES.length]!;
          return <line key={`ring-${i}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke="#FFFFFF" strokeOpacity="0.08" />;
        })}

        {/* Skill → hub connections with travelling light */}
        {NODES.map((n, i) => (
          <g key={`link-${i}`}>
            <path id={`loso-path-${i}`} d={curve(n)} fill="none" stroke="url(#loso-line)" strokeWidth="1.5" />
            {motion && (
              <circle r="3.5" fill="#F4B942">
                <animateMotion dur={`${3.2 + (i % 3) * 0.6}s`} begin={`${n.delay}s`} repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                  <mpath href={`#loso-path-${i}`} />
                </animateMotion>
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.8;1" dur={`${3.2 + (i % 3) * 0.6}s`} begin={`${n.delay}s`} repeatCount="indefinite" />
              </circle>
            )}
          </g>
        ))}
        </g>

        {/* Lake Hawassa: layered waves gently sliding */}
        <g clipPath="url(#loso-frame)">
          <rect x="0" y="448" width={SIZE} height="72" fill="url(#loso-lake)" />
          {[
            { y: 462, amp: 7, o: 0.32, dur: "9s" },
            { y: 482, amp: 6, o: 0.22, dur: "13s" },
            { y: 502, amp: 5, o: 0.14, dur: "17s" },
          ].map((w) => (
            <path key={w.y} d={WAVE(w.y, w.amp)} fill="none" stroke="#FFFFFF" strokeOpacity={w.o} strokeWidth="1.6" strokeLinecap="round">
              {motion && <animateTransform attributeName="transform" type="translate" from="0 0" to="-260 0" dur={w.dur} repeatCount="indefinite" />}
            </path>
          ))}
        </g>
      </svg>

      {/* Hub: Loso mark with pulsing halo */}
      <div
        className="absolute flex items-center justify-center"
        style={{ left: `${(HUB.x / SIZE) * 100}%`, top: `${(HUB.y / SIZE) * 100}%`, width: "26%", height: "26%", transform: "translate(-50%, -50%)" }}
      >
        <span className="absolute inset-0 animate-pulse-ring rounded-[32%] bg-gold/35" />
        <span className="absolute inset-0 animate-pulse-ring rounded-[32%] bg-gold/25 [animation-delay:1.6s]" />
        <span className="relative flex h-full w-full items-center justify-center rounded-[32%] bg-white/10 shadow-[0_0_70px_rgba(244,185,66,0.45)] ring-1 ring-white/25 backdrop-blur-sm">
          <LogoMark className="h-[62%] w-[62%] drop-shadow-xl" />
        </span>
      </div>

      {/* Skill stars: orbit with the constellation, counter-rotating so icons stay upright */}
      <div className="absolute inset-0 animate-constellation" style={{ transformOrigin: `${(HUB.x / SIZE) * 100}% ${(HUB.y / SIZE) * 100}%` }}>
      {NODES.map((n, i) => {
        const Icon = n.icon;
        return (
          <div
            key={`node-${i}`}
            className="absolute"
            style={{ left: `${(n.x / SIZE) * 100}%`, top: `${(n.y / SIZE) * 100}%`, transform: "translate(-50%, -50%)" }}
          >
            <div className="animate-constellation-reverse">
            <div
              className="group flex h-11 w-11 animate-float items-center justify-center rounded-2xl bg-white text-[#182B43] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.45)] ring-1 ring-white/60 sm:h-12 sm:w-12"
              style={{ animationDelay: `${n.delay}s`, animationDuration: `${5 + (i % 3)}s` }}
            >
              <Icon className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-brand-deep" />
            </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
