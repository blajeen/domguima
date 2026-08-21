"use client";

import Image from "next/image";
import Link from "next/link";
import { Drawer } from "@/components/ui/Drawer";
import { lineKey, useCart } from "@/lib/store/cart";
import { formatPrice } from "@/lib/utils/format";

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
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between text-ink-600">
                <dt>Subtotal</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              {savings > 0 && (
                <div className="flex justify-between font-semibold text-success">
                  <dt>Você economiza</dt>
                  <dd>{formatPrice(savings)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-ink-100 pt-2 text-base font-extrabold text-ink-900">
                <dt>Total</dt>
                <dd>{formatPrice(subtotal)}</dd>
              </div>
              <p className="text-xs text-ink-400">
                Frete calculado na próxima etapa.
              </p>
            </dl>

            <Link
              href="/checkout/rapido"
              onClick={closeCart}
              className="block rounded-lg bg-[#25D366] px-4 py-3 text-center text-sm font-extrabold text-white transition-colors hover:bg-[#20bd5a]"
            >
              Finalizar rápido com vendedor
            </Link>
            <p className="text-center text-xs text-ink-400">Só seu nome. Ideal para Uberlândia.</p>

            <Link
              href="/checkout"
              onClick={closeCart}
              className="block rounded-lg border border-ink-200 px-4 py-2.5 text-center text-sm font-bold text-ink-700 transition-colors hover:border-gold-400 hover:bg-gold-50"
            >
              Checkout completo
            </Link>

            <button
              type="button"
              onClick={closeCart}
              className="w-full py-1 text-center text-sm font-medium text-ink-500 transition-colors hover:text-ink-800"
            >
              Continuar comprando
            </button>
          </div>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <EmptyCart onClose={closeCart} />
      ) : (
        <ul className="divide-y divide-ink-100">
          {items.map((item) => (
            <CartLine key={lineKey(item)} item={item} />
          ))}
        </ul>
      )}
    </Drawer>
  );
}

function CartLine({ item }: { item: ReturnType<typeof useCart>["items"][number] }) {
  const { setQuantity, removeItem } = useCart();
  const key = lineKey(item);

  return (
    <li className="flex gap-3 p-4">
      <Link href={`/produto/${item.slug}`} className="shrink-0">
        <Image
          src={item.image}
          alt={item.name}
          width={72}
          height={72}
          className="h-18 w-18 rounded-lg border border-ink-100 object-contain"
        />
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={`/produto/${item.slug}`}
          className="line-clamp-2-safe text-sm font-medium text-ink-700 hover:text-gold-800"
        >
          {item.name}
        </Link>
        {item.variant && (
          <p className="mt-0.5 text-xs text-ink-400">{item.variant}</p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center rounded-lg border border-ink-200">
            <QtyButton
              label="Diminuir quantidade"
              onClick={() => setQuantity(key, item.quantity - 1)}
            >
              −
            </QtyButton>
            <span className="min-w-8 text-center text-sm font-semibold tabular-nums">
              {item.quantity}
            </span>
            <QtyButton
              label="Aumentar quantidade"
              disabled={item.quantity >= item.stock}
              onClick={() => setQuantity(key, item.quantity + 1)}
            >
              +
            </QtyButton>
          </div>

          <p className="text-sm font-extrabold text-ink-900">
            {formatPrice(item.price * item.quantity)}
          </p>
        </div>

        {item.quantity >= item.stock && (
          <p className="mt-1 text-xs text-promo">
            {item.stock === 1
              ? "Última unidade em estoque"
              : `Últimas ${item.stock} unidades em estoque`}
          </p>
        )}

        <button
          type="button"
          onClick={() => removeItem(key)}
          className="mt-1.5 text-xs font-medium text-ink-400 underline-offset-2 transition-colors hover:text-promo hover:underline"
        >
          Remover
        </button>
      </div>
    </li>
  );
}

function QtyButton({
  children,
  onClick,
  label,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center text-base font-bold text-ink-600 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:text-ink-300"
    >
      {children}
    </button>
  );
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ink-50 text-3xl">
        🛒
      </div>
      <p className="text-base font-bold text-ink-900">
        Seu carrinho está vazio
      </p>
      <p className="mt-1 max-w-xs text-sm text-ink-500">
        Dá uma olhada nas ofertas — tem bastante coisa boa com desconto.
      </p>
      <Link
        href="/ofertas"
        onClick={onClose}
        className="mt-5 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-600"
      >
        Ver ofertas
      </Link>
    </div>
  );
}
