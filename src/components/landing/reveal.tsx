"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Scroll-reveal wrapper (handoff: elements fade + rise on entering the viewport).
 * Renders a <div> carrying the reveal classes, so it can BE a card / header /
 * grid item directly. `index` staggers the transition like the prototype.
 */
export function Reveal({
  index = 0,
  className = "",
  style,
  children,
  id,
}: {
  index?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      className={`lp-reveal${shown ? " lp-reveal-in" : ""} ${className}`.trim()}
      style={{ transitionDelay: `${((index % 6) * 0.07).toFixed(2)}s`, ...style }}
    >
      {children}
    </div>
  );
}
