"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * O "Mais" do menu de categorias: um <details>, que abre e fecha mesmo antes
 * de a página hidratar. O JavaScript só completa o que o <details> não faz
 * sozinho: fechar ao clicar fora, no Esc e ao escolher uma categoria (o header
 * continua na tela depois da navegação, e o menu ficaria aberto na página nova).
 *
 * O painel é branco sólido com a sombra de flutuação: dropdown não está entre
 * os lugares de vidro da especificação. Entra só na opacidade. As duas regras
 * de entrada cobrem os dois jeitos de o navegador tratar o conteúdo do
 * <details> fechado: com o estilo já calculado vale a transição de opacity-0
 * para opacity-100; sem ele, vale o @starting-style.
 */
export function MenuMais({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const details = ref.current;
    if (!aberto || !details) return;

    function onPointerDown(event: PointerEvent) {
      if (!details?.contains(event.target as Node)) details?.removeAttribute("open");
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !details) return;
      details.removeAttribute("open");
      details.querySelector("summary")?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [aberto]);

  function fecharAoEscolher(event: React.MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a")) ref.current?.removeAttribute("open");
  }

  return (
    <details
      ref={ref}
      className={`group relative h-full ${className}`}
      onToggle={(event) => setAberto(event.currentTarget.open)}
    >
      <summary className="flex h-full cursor-pointer list-none items-center gap-1 px-3 text-sm font-semibold text-grafite-900 transition-colors duration-(--duracao-toque) hover:shadow-[inset_0_-2px_0_var(--color-ouro)] focus-visible:-outline-offset-2 group-open:shadow-[inset_0_-2px_0_var(--color-ouro)] [&::-webkit-details-marker]:hidden">
        Mais<span className="sr-only"> categorias</span>
        <Icon
          name="seta-baixo"
          size={16}
          className="transition-transform duration-(--duracao-toque) ease-out group-open:rotate-180"
        />
      </summary>
      <div
        onClick={fecharAoEscolher}
        className="absolute right-0 top-[calc(100%+0.25rem)] z-50 flex w-64 flex-col gap-0.5 rounded-card border border-fio bg-white p-1.5 opacity-0 shadow-float transition-opacity duration-(--duracao-entrada) ease-out group-open:opacity-100 group-open:starting:opacity-0"
      >
        {children}
      </div>
    </details>
  );
}
