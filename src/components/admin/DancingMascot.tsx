"use client";

import { useEffect, useRef } from "react";

export function DancingMascot() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false, frame = 0;
    let player: Awaited<ReturnType<typeof import("./dancing-mascot")["createDancingMascot"]>> | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = async () => {
      try {
        const { createDancingMascot } = await import("./dancing-mascot");
        if (cancelled || !canvas.current) return;
        player = await createDancingMascot(canvas.current);
        if (cancelled) { player.dispose(); return; }
        let last = performance.now(), lastPaint = 0;
        const tick = (now: number) => {
          if (cancelled) return;
          if (!document.hidden && now - lastPaint >= 1000 / 30) {
            player!.draw((now - last) / 1000, reduced.matches); last = now; lastPaint = now;
          } else if (document.hidden) last = now;
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      } catch { /* A decorative companion must never prevent use of the admin panel. */ }
    };
    const delay = window.setTimeout(() => void start(), 250);
    return () => { cancelled = true; clearTimeout(delay); cancelAnimationFrame(frame); player?.dispose(); };
  }, []);
  return <div className="admin-dancing-mascot admin-no-print" aria-hidden="true"><canvas ref={canvas} /></div>;
}
