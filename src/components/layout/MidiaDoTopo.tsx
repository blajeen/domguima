"use client";

import { useEffect, useRef } from "react";

/**
 * Região de foto no topo da página (o banner da home). Enquanto ela passa por
 * baixo da parte escura do header, o header ganha `data-over-media` e troca o
 * grafite pelo vidro escuro (ver Header.tsx). Sobre a grade de produtos, e em
 * todas as outras páginas, ele fica sólido: vidro sobre fundo chapado só
 * parece cinza e custa GPU a cada rolagem.
 *
 * O conteúdo continua vindo do servidor (children): daqui só saem os dois
 * marcadores de borda e o observador.
 *
 * Como decide: um marcador de 1 px na borda de cima da região e outro na de
 * baixo, e uma raiz que vai da base da parte escura do header até muito abaixo
 * da tela. Um marcador só deixa de cruzar a raiz quando passa para cima, para
 * trás do header. A região está sob o header quando o marcador de cima já
 * passou e o de baixo ainda não. Com a raiz do tamanho da tela, um salto de
 * rolagem (Home, voltar ao topo) podia levar um marcador de um lado da tela
 * ao outro sem cruzar borda nenhuma, e o atributo ficava no estado errado.
 */
export function MidiaDoTopo({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const topo = useRef<HTMLSpanElement>(null);
  const base = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-cabecalho]");
    const parteEscura = header?.querySelector<HTMLElement>("[data-cabecalho-escuro]");
    const marcadorDeCima = topo.current;
    const marcadorDeBaixo = base.current;
    if (!header || !parteEscura || !marcadorDeCima || !marcadorDeBaixo) return;

    const passou = new Map<Element, boolean>([
      [marcadorDeCima, false],
      [marcadorDeBaixo, false],
    ]);
    let observador: IntersectionObserver | undefined;

    const montar = () => {
      observador?.disconnect();
      // O header é fixo no topo: a base da parte escura, na tela, é a altura
      // dela. Ela muda no breakpoint lg, por isso o observador é refeito
      // quando a parte escura muda de tamanho.
      const limite = Math.round(parteEscura.getBoundingClientRect().bottom);
      observador = new IntersectionObserver(
        (entradas) => {
          for (const entrada of entradas) passou.set(entrada.target, !entrada.isIntersecting);
          header.toggleAttribute(
            "data-over-media",
            Boolean(passou.get(marcadorDeCima)) && !passou.get(marcadorDeBaixo),
          );
        },
        { rootMargin: `-${limite}px 0px 100000px 0px` },
      );
      observador.observe(marcadorDeCima);
      observador.observe(marcadorDeBaixo);
    };

    // O ResizeObserver avisa uma vez ao começar a observar: é ele que monta o
    // primeiro IntersectionObserver.
    const tamanho = new ResizeObserver(montar);
    tamanho.observe(parteEscura);

    return () => {
      tamanho.disconnect();
      observador?.disconnect();
      header.removeAttribute("data-over-media");
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <span ref={topo} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" />
      {children}
      <span ref={base} aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />
    </div>
  );
}
