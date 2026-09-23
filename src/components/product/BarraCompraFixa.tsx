"use client";

import { type RefObject, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PriceTag } from "@/components/ui/PriceTag";
import type { PaymentLines } from "@/lib/utils/format";

/**
 * Barra de compra presa embaixo da tela no celular (e no tablet, onde a
 * página também vira uma coluna só). Aparece quando o bloco de compra
 * principal passa para cima da tela, e some quando ele volta: antes de o
 * cliente chegar ao preço, a barra só repetiria o que vem logo abaixo.
 *
 * Vidro escuro com a página rolando por trás, preço pequeno e o mesmo botão
 * principal do bloco. Enquanto ela está à vista, `data-barra-compra` no <html>
 * sobe o botão flutuante do WhatsApp e reserva o espaço no fim da página (ver
 * globals.css e WhatsAppFloat).
 */
export function BarraCompraFixa({
  alvo,
  cents,
  lines,
  rotulo,
  onComprar,
}: {
  /** O bloco de compra que a barra substitui quando sai da tela. */
  alvo: RefObject<HTMLElement | null>;
  cents: number;
  lines: PaymentLines | null;
  rotulo: string;
  onComprar: () => void;
}) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const elemento = alvo.current;
    if (!elemento) return;
    // O header é fixo: o bloco "sai da tela" quando passa por baixo dele.
    const topo = alturaDoHeader();
    // A raiz vai do header até muito abaixo da tela, então o bloco só deixa de
    // cruzá-la quando está acima do header. Com a raiz do tamanho da tela, um
    // salto de rolagem (voltar ao topo, Home, âncora) levava o bloco de um
    // lado da tela ao outro sem cruzar borda nenhuma, o observer não avisava
    // e a barra ficava no estado errado.
    const observer = new IntersectionObserver(
      ([entrada]) => {
        const limite = entrada.rootBounds?.top ?? topo;
        setVisivel(!entrada.isIntersecting && entrada.boundingClientRect.bottom <= limite);
      },
      { rootMargin: `-${topo}px 0px 100000px 0px` },
    );
    observer.observe(elemento);
    return () => observer.disconnect();
  }, [alvo]);

  useEffect(() => {
    if (!visivel) return;
    const html = document.documentElement;
    html.setAttribute("data-barra-compra", "");
    return () => html.removeAttribute("data-barra-compra");
  }, [visivel]);

  return (
    <div
      // Escondida, fica fora do Tab e do leitor de tela.
      inert={!visivel}
      className={`glass-dark fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] transition-[translate,visibility] duration-(--duracao-entrada) ease-out lg:hidden ${
        visivel ? "visible translate-y-0" : "invisible translate-y-full"
      }`}
    >
      <div className="site-shell flex min-h-16 items-center justify-between gap-3 py-2.5">
        <PriceTag size="compacto" tone="papel" cents={cents} lines={lines} />
        {/* Foco em papel: o ouro do foco padrão fica em ~1:1 sobre o vidro. */}
        <Button variant="claro" onClick={onComprar} className="shrink-0 focus-visible:outline-papel">
          {rotulo}
        </Button>
      </div>
    </div>
  );
}

/** --header-h em px (o valor vem em rem do globals.css). */
function alturaDoHeader(): number {
  const raiz = getComputedStyle(document.documentElement);
  const valor = raiz.getPropertyValue("--header-h").trim();
  const numero = Number.parseFloat(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.round(valor.endsWith("rem") ? numero * Number.parseFloat(raiz.fontSize) : numero);
}
