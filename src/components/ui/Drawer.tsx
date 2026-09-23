"use client";

import { useEffect, useRef } from "react";
import { IconButton } from "./IconButton";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Lado de onde o painel entra. */
  side?: "right" | "left";
  children: React.ReactNode;
  /** Rodapé fixo (ex.: resumo + botão finalizar). */
  footer?: React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Painel lateral acessível: trava o scroll do fundo, fecha no Esc, prende o
 * foco enquanto aberto e devolve o foco a quem abriu.
 */
export function Drawer({
  open,
  onClose,
  title,
  side = "right",
  children,
  footer,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Trava o scroll sem deslocar o layout (o body já tem scrollbar-gutter).
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    // Foca o primeiro elemento útil do painel.
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (nodes.length === 0) return;

      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-[60] ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-ink-950/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-y-0 flex w-full max-w-md flex-col bg-white shadow-drawer transition-transform duration-300 ease-out ${
          side === "right"
            ? `right-0 ${open ? "translate-x-0" : "translate-x-full"}`
            : `left-0 ${open ? "translate-x-0" : "-translate-x-full"}`
        }`}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-ink-100 px-4 py-3.5">
          <h2 className="text-base font-bold text-ink-900">{title}</h2>
          <IconButton icon="fechar" label="Fechar" onClick={onClose} className="-mr-2" />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-ink-100 bg-white p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
