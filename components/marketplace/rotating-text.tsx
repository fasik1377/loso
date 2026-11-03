"use client";

import { useEffect, useState } from "react";

/** Cycles through phrases with a slide-up animation. Decorative: screen readers get the first phrase only. */
export function RotatingText({ items, intervalMs = 2600, className = "" }: { items: string[]; intervalMs?: number; className?: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), intervalMs);
    return () => clearInterval(t);
  }, [items.length, intervalMs]);
  return (
    <span className={`relative inline-block overflow-hidden align-bottom ${className}`}>
      <span className="sr-only">{items[0]}</span>
      <span key={index} aria-hidden="true" className="inline-block animate-word-in">
        {items[index]}
      </span>
    </span>
  );
}
