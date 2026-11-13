"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";

const POSITION_KEY = "domguima.mascot.position";

export function DancingMascot() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const position = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ id: number; mouseX: number; mouseY: number; x: number; y: number } | null>(null);
  const move = useCallback((x: number, y: number, save = false) => {
    const element = container.current;
    if (!element || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const bounds = element.getBoundingClientRect();
    const next = {
      x: Math.min(Math.max(8, window.innerWidth - bounds.width - 8), Math.max(8, x)),
      y: Math.min(Math.max(8, window.innerHeight - bounds.height - 8), Math.max(8, y)),
    };
    position.current = next;
    Object.assign(element.style, { left: `${next.x}px`, top: `${next.y}px`, right: "auto", bottom: "auto" });
    if (save) { try { localStorage.setItem(POSITION_KEY, JSON.stringify(next)); } catch { /* Storage may be disabled. */ } }
  }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(POSITION_KEY);
      if (saved) {
        const value = JSON.parse(saved);
        if (typeof value?.x === "number" && typeof value?.y === "number") move(value.x, value.y);
      }
    } catch { /* Ignore invalid or unavailable preferences. */ }
    const resize = () => { if (position.current) move(position.current.x, position.current.y); };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [move]);
  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (position.current) move(position.current.x, position.current.y, true);
  };
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
  return <div
    ref={container}
    className="admin-dancing-mascot admin-no-print"
    role="group"
    aria-label="Personagem dançando. Segure o botão esquerdo e arraste para mover, ou use as setas do teclado."
    tabIndex={0}
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      drag.current = { id: event.pointerId, mouseX: event.clientX, mouseY: event.clientY, x: bounds.x, y: bounds.y };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.dataset.dragging = "true";
    }}
    onPointerMove={event => {
      const start = drag.current;
      if (!start || start.id !== event.pointerId) return;
      move(start.x + event.clientX - start.mouseX, start.y + event.clientY - start.mouseY);
    }}
    onPointerUp={stopDrag}
    onPointerCancel={stopDrag}
    onLostPointerCapture={stopDrag}
    onKeyDown={event => {
      const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const direction = directions[event.key];
      if (!direction) return;
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect(), step = event.shiftKey ? 32 : 8;
      move(bounds.x + direction[0] * step, bounds.y + direction[1] * step, true);
    }}
  ><canvas ref={canvas} aria-hidden="true" /></div>;
}
