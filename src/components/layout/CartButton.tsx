"use client";

import { Icon } from "@/components/ui/Icon";
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
        <Icon name="carrinho" />
        {ready && count > 0 && (
          // A chave muda a cada item que entra: o contador remonta e o pulso
          // roda uma vez. Só transform, e nada para quem pediu menos movimento.
          <span
            key={`${lastAdded ?? ""}:${count}`}
            className={`absolute -right-2 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-pill bg-ouro-claro px-1 text-xs font-bold tabular-nums text-grafite-900 ${
              lastAdded ? "motion-safe:animate-pulso" : ""
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
