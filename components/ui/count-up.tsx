"use client";

import { useEffect, useRef, useState } from "react";

/** Counts up to `value` when scrolled into view. Renders the final number for no-JS and reduced motion. */
export function CountUp({ value, durationMs = 1400 }: { value: number; durationMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / durationMs);
        setShown(Math.round(value * (1 - Math.pow(1 - p, 3)))); // ease-out cubic
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      setShown(0);
      frame = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, durationMs]);

  return (
    <span ref={ref} className="tabular-nums">
      {shown.toLocaleString("en-US")}
    </span>
  );
}
