"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";
import { useDialogoModal } from "./useDialogoModal";
import { useVidroParado } from "./useVidroParado";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Lado de onde o painel entra. */
  side?: "right" | "left";
  children: React.ReactNode;
  /** Rodapé fixo (ex.: resumo + botão finalizar), preso embaixo sobre a lista. */
  footer?: React.ReactNode;
  /**
   * Rodapé em vidro claro, com a lista rolando por baixo. A especificação põe
   * vidro só no rodapé do carrinho; nas outras gavetas ele é branco sólido.
   */
  rodapeVidro?: boolean;
}

const semAssinatura = () => () => {};

/**
 * Painel lateral acessível (carrinho, menu e filtros): trava a rolagem do
 * fundo, fecha no Esc, prende o foco enquanto aberto e devolve o foco a quem
 * abriu (useDialogoModal).
 *
 * Vai direto para o <body> (portal). O menu do celular é montado dentro do
 * header, e lá a gaveta herdava a cor de texto e o foco do grafite e ficava na
 * camada do header. Fechada, não há o que mostrar no HTML do servidor: o
 * portal só monta no navegador.
 *
 * Aparência: o painel desliza em 320 ms com a curva da loja, sobre uma tinta
 * grafite que aparece junto. O desfoque da página atrás (6 px) e o vidro do
 * rodapé do carrinho só ligam com a gaveta parada (useVidroParado): durante o
 * deslize, e na saída, tudo é sólido.
 */
export function Drawer({
  open,
  onClose,
  title,
  side = "right",
  children,
  footer,
  rodapeVidro = false,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const rolagemRef = useRef<HTMLDivElement>(null);
  const rodapeRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const noNavegador = useSyncExternalStore(semAssinatura, () => true, () => false);
  const [vidro, aoTerminarTransicao] = useVidroParado(open);

  useDialogoModal(panelRef, open, onClose);

  // O rodapé cobre o fim da lista: ao navegar pelo Tab, o item em foco para
  // acima dele, e não por baixo.
  const temRodape = Boolean(footer);
  useEffect(() => {
    const rolagem = rolagemRef.current;
    const rodape = rodapeRef.current;
    if (!rolagem || !rodape) return;
    const observador = new ResizeObserver(() => {
      rolagem.style.scrollPaddingBottom = `${rodape.offsetHeight}px`;
    });
    observador.observe(rodape);
    return () => {
      observador.disconnect();
      rolagem.style.scrollPaddingBottom = "";
    };
  }, [temRodape, noNavegador]);

  if (!noNavegador) return null;

  return createPortal(
    <div
      // Fechada, a gaveta sai do Tab e do leitor de tela na hora (inert) e da
      // pintura no fim da animação (`visibility` só entra na transição ao
      // fechar). Assim a sombra do painel escondido não aparece na borda da
      // tela.
      inert={!open}
      className={`fixed inset-0 z-[60] ${
        open ? "visible" : "invisible transition-[visibility] duration-(--duracao-gaveta)"
      }`}
    >
      {/* Desfoque da página atrás: camada própria, sem transição, que liga
          seco com a gaveta parada e sai na hora ao fechar. Abaixo de 28rem (a
          largura máxima do painel) ele cobre a tela inteira, e o desfoque só
          custaria. */}
      {vidro && (
        <div
          aria-hidden
          className="absolute inset-0 hidden backdrop-blur-[6px] reduced-transparency:backdrop-blur-none min-[28rem]:block"
        />
      )}

      {/* A tinta é quem aparece e some aos poucos. */}
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 bg-grafite-950/40 transition-opacity duration-(--duracao-gaveta) ease-out reduced-transparency:bg-grafite-950/60 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onTransitionEnd={aoTerminarTransicao}
        className={`absolute inset-y-0 flex w-full max-w-md flex-col bg-white text-grafite-900 shadow-float transition-transform duration-(--duracao-gaveta) ease-out ${
          side === "right"
            ? `right-0 ${open ? "translate-x-0" : "translate-x-full"}`
            : `left-0 ${open ? "translate-x-0" : "-translate-x-full"}`
        }`}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-fio px-4">
          <h2 id={tituloId} className="text-lg font-bold text-grafite-900">
            {title}
          </h2>
          <IconButton icon="fechar" label="Fechar" onClick={onClose} className="-mr-2.5" />
        </header>

        <div ref={rolagemRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="flex min-h-full flex-col">
            <div className="flex-1">{children}</div>
            {footer && (
              <div
                ref={rodapeRef}
                className={`sticky bottom-0 border-t border-fio p-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
                  rodapeVidro && vidro ? "glass-light" : "bg-white"
                }`}
              >
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
