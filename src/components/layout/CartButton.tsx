"use client";

import { useCart } from "@/lib/store/cart";

/** Botão do carrinho no header, com contador que pulsa ao adicionar item. */
export function CartButton() {
  const { count, openCart, ready, lastAdded } = useCart();

  return (
    <button
      type="button"
      onClick={openCart}
      className="relative flex items-center gap-2 rounded-lg px-2 py-1 text-white transition-colors hover:bg-white/10 sm:px-2.5"
      aria-label={
        count > 0 ? `Abrir carrinho — ${count} item(ns)` : "Abrir carrinho"
      }
    >
      <span className="relative">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
          <path
            d="M3 4h2.2l2 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20.5 8H6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="20" r="1.4" fill="currentColor" />
          <circle cx="17" cy="20" r="1.4" fill="currentColor" />
        </svg>
        {ready && count > 0 && (
          <span
            key={lastAdded ?? "count"}
            className={`absolute -right-2 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1 text-[11px] font-extrabold text-ink-900 ${
              lastAdded ? "animate-[fade-up_0.35s_ease-out]" : ""
            }`}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      <span className="hidden text-sm font-semibold lg:inline">Carrinho</span>
    </button>
  );
}
