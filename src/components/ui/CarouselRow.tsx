"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Carrossel horizontal sem dependência externa: usa scroll nativo com
 * scroll-snap, então o swipe no celular é o do próprio sistema (fluido, com
 * inércia). No desktop aparecem as setas, que só existem quando há o que rolar.
 */
export function CarouselRow({
  children,
  className = "",
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [update]);

  const scrollBy = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    // Rola ~85% da largura visível: mantém um item de referência na tela.
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="group/carousel relative">
      <div
        ref={ref}
        className={`scroll-row gap-3 pb-1 sm:gap-4 ${className}`}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        {children}
      </div>

      <Arrow
        side="left"
        visible={canScrollLeft}
        onClick={() => scrollBy(-1)}
        label="Ver itens anteriores"
      />
      <Arrow
        side="right"
        visible={canScrollRight}
        onClick={() => scrollBy(1)}
        label="Ver próximos itens"
      />
    </div>
  );
}

function Arrow({
  side,
  visible,
  onClick,
  label,
}: {
  side: "left" | "right";
  visible: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink-100 bg-white/95 text-ink-700 shadow-card backdrop-blur transition-all hover:border-gold-300 hover:text-gold-700 lg:flex ${
        side === "left" ? "-left-4" : "-right-4"
      } ${visible ? "opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden>
        <path
          d={side === "left" ? "M12.5 4L6.5 10l6 6" : "M7.5 4l6 6-6 6"}
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
