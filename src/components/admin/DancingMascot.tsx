"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

const POSITION_KEY = "domguima.mascot.position";

function Mascote({ saindo }: { saindo: boolean }) {
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
    className={`admin-dancing-mascot admin-mascote-queda admin-no-print ${saindo ? "admin-mascote-saindo" : ""}`}
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
  >
    {/* Paraquedas: abre na descida e some depois do pouso. */}
    <svg className="admin-paraquedas" viewBox="0 0 120 90" aria-hidden="true">
      <path d="M6 40 Q60 -18 114 40 Q100 30 87 40 Q74 30 60 40 Q46 30 33 40 Q20 30 6 40Z" fill="#e1bd72" stroke="#85611d" strokeWidth="2" />
      <path d="M33 40 Q60 -6 87 40" fill="#c0392b" opacity=".85" />
      <path d="M6 40 L52 88 M33 40 L56 88 M60 40 L60 88 M87 40 L64 88 M114 40 L68 88" stroke="#3b3c42" strokeWidth="1.2" />
    </svg>
    <canvas ref={canvas} aria-hidden="true" />
  </div>;
}

const INTERVALO_MS = 5 * 60_000;
const PRIMEIRO_VOO_MS = 15_000;
const VOO_MS = 7_000;
const NA_TELA_MS = 30_000;

/**
 * A cada 5 minutos um avião cruza o topo do painel e solta o mascote de
 * paraquedas. Ele dança por 30 segundos e some. O 3D só existe enquanto ele
 * está na tela (o canvas é montado e descartado a cada visita).
 */
export function DancingMascot() {
  const [fase, setFase] = useState<"oculto" | "aviao" | "mascote" | "saindo">("oculto");
  useEffect(() => {
    const timers: number[] = [];
    const voo = () => {
      setFase("aviao");
      // O mascote salta no meio da travessia do avião.
      timers.push(window.setTimeout(() => setFase("mascote"), VOO_MS * 0.45));
      timers.push(window.setTimeout(() => setFase("saindo"), VOO_MS * 0.45 + NA_TELA_MS));
      timers.push(window.setTimeout(() => setFase("oculto"), VOO_MS * 0.45 + NA_TELA_MS + 700));
    };
    timers.push(window.setTimeout(voo, PRIMEIRO_VOO_MS));
    const ciclo = window.setInterval(voo, INTERVALO_MS);
    return () => { clearInterval(ciclo); timers.forEach(clearTimeout); };
  }, []);
  return <>
    {fase !== "oculto" && <div key="aviao" className="admin-aviao admin-no-print" aria-hidden="true" style={{ animationDuration: `${VOO_MS}ms` }}>
      <svg viewBox="0 0 120 50" width="120" height="50"><path d="M4 26 L22 22 L30 8 L38 8 L36 22 L78 20 L96 4 L104 4 L98 21 L112 22 Q118 25 112 28 L98 29 L104 46 L96 46 L78 30 L36 28 L38 42 L30 42 L22 28 Z" fill="#f4f2ed" stroke="#121316" strokeWidth="2" strokeLinejoin="round" transform="matrix(-1 0 0 1 120 0)" /><circle cx="44" cy="25" r="2" fill="#3b82f6" /><circle cx="52" cy="25" r="2" fill="#3b82f6" /><circle cx="60" cy="25" r="2" fill="#3b82f6" /></svg>
    </div>}
    {(fase === "mascote" || fase === "saindo") && <Mascote saindo={fase === "saindo"} />}
  </>;
}
