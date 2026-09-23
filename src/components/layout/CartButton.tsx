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
      // 44 px de altura e de largura mínima: alvo de toque também no celular.
      // A cor vem do header (papel sobre o grafite ou o vidro).
      className="relative flex h-11 min-w-11 items-center justify-center gap-2 rounded-control px-2.5 transition-colors duration-(--duracao-toque) hover:bg-white/10"
      aria-label={
        count > 0 ? `Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}` : "Abrir carrinho"
      }
      aria-haspopup="dialog"
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
