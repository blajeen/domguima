"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";

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
  // O invólucro só centraliza e não recebe clique: com a seta escondida, o
  // clique passa para o card de baixo. Só o botão visível volta a receber
  // (pointer-events é herdado). A opacidade fica no próprio botão, porque um
  // ancestral translúcido cortaria o fundo que o vidro desfoca; e troca sem
  // fade, porque o vidro não anima.
  return (
    <div
      className={`pointer-events-none absolute top-1/2 z-10 hidden -translate-y-1/2 lg:flex ${
        side === "left" ? "-left-4" : "-right-4"
      }`}
    >
      <IconButton
        icon={side === "left" ? "seta-esquerda" : "seta-direita"}
        label={label}
        variant="vidro"
        onClick={onClick}
        tabIndex={visible ? 0 : -1}
        aria-hidden={!visible}
        className={
          visible
            ? "pointer-events-auto opacity-0 group-hover/carousel:opacity-100 focus-visible:opacity-100"
            : "opacity-0"
        }
      />
    </div>
  );
}
