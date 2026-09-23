"use client";

import { Button, ButtonLink } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { lineKey, useCart } from "@/lib/store/cart";
import { CartLineItem } from "./CartLineItem";
import { CartTotals } from "./CartTotals";

export function CartDrawer() {
  const { items, isOpen, closeCart, subtotal, savings, count } = useCart();

  return (
    <Drawer
      open={isOpen}
      onClose={closeCart}
      title={count > 0 ? `Meu carrinho (${count})` : "Meu carrinho"}
      footer={
        items.length > 0 ? (
          <div className="space-y-3">
            <CartTotals
              items={items}
              subtotal={subtotal}
              savings={savings}
              shipping="Calculado na próxima etapa"
              showSubtotal={false}
            />

            {/* O pedido rápido termina no WhatsApp do vendedor: por isso o verde. */}
            <ButtonLink href="/checkout/rapido" onClick={closeCart} variant="whatsapp" fullWidth>
              Finalizar rápido com vendedor
            </ButtonLink>
            <p className="text-center text-xs text-ink-500">Só seu nome. Ideal para Uberlândia.</p>

            <ButtonLink href="/checkout" onClick={closeCart} variant="secundario" fullWidth>
              Checkout completo
            </ButtonLink>

            <Button onClick={closeCart} variant="fantasma" size="sm" fullWidth>
              Continuar comprando
            </Button>
          </div>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <EmptyCart onClose={closeCart} />
      ) : (
        <ul className="divide-y divide-fio">
          {items.map((item) => (
            <CartLineItem key={lineKey(item)} item={item} />
          ))}
        </ul>
      )}
    </Drawer>
  );
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {/* Ícone solto, igual ao da página /carrinho: sem círculo em volta. */}
      <Icon name="carrinho" size={40} className="text-ink-400" />
      <p className="mt-4 text-base font-bold text-ink-900">
        Seu carrinho está vazio
      </p>
      <p className="mt-1 max-w-xs text-sm text-ink-500">
        Dá uma olhada nas ofertas. Tem bastante coisa com desconto.
      </p>
      <ButtonLink href="/ofertas" onClick={onClose} className="mt-5">
        Ver ofertas
      </ButtonLink>
    </div>
  );
}
