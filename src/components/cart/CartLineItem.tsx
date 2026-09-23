"use client";

import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PriceTag } from "@/components/ui/PriceTag";
import { type CartItem, lineKey, useCart } from "@/lib/store/cart";
import { formatPrice } from "@/lib/utils/format";

/**
 * Um item da lista do carrinho, igual na página e na gaveta: foto no poço
 * branco, nome, opção escolhida, quantidade e o valor da linha com o
 * preço-assinatura (e o "de" riscado quando há desconto).
 */
export function CartLineItem({
  item,
  size = "gaveta",
}: {
  item: CartItem;
  /** A página tem mais largura: foto e nome um pouco maiores. */
  size?: "gaveta" | "pagina";
}) {
  const { setQuantity, removeItem } = useCart();
  const key = lineKey(item);
  const href = `/produto/${item.slug}`;
  const pagina = size === "pagina";

  return (
    <li className={`flex gap-3 p-4 ${pagina ? "sm:gap-4" : ""}`}>
      {/* A foto repete o link do nome: fica fora do Tab e do leitor de tela. */}
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className={`relative shrink-0 self-start overflow-hidden rounded-card border border-fio bg-white ${
          pagina ? "size-20 sm:size-24" : "size-18"
        }`}
      >
        {item.image ? (
          <Image src={item.image} alt="" fill sizes="96px" className="object-contain p-1" />
        ) : (
          <span className="flex size-full items-center justify-center text-ink-300">
            <Icon name="caixa" size={24} />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={href}
          className={`line-clamp-2-safe font-medium text-grafite-900 decoration-ouro underline-offset-2 hover:underline ${
            pagina ? "text-sm sm:text-base" : "text-sm"
          }`}
        >
          {item.name}
        </Link>
        {item.variant && <p className="mt-0.5 text-xs text-ink-500">{item.variant}</p>}
        {item.quantity > 1 && (
          <p className="mt-0.5 text-xs tabular-nums text-ink-500">{formatPrice(item.price)} cada</p>
        )}

        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <div className="flex items-center rounded-control border border-fio bg-white">
            <QtyButton
              icon="menos"
              label={
                item.quantity === 1
                  ? `Tirar ${item.name} do carrinho`
                  : `Diminuir quantidade de ${item.name}`
              }
              onClick={() => setQuantity(key, item.quantity - 1)}
            />
            <span className="min-w-8 text-center text-sm font-semibold tabular-nums text-grafite-900">
              {item.quantity}
            </span>
            <QtyButton
              icon="mais"
              label={`Aumentar quantidade de ${item.name}`}
              disabled={item.quantity >= item.stock}
              onClick={() => setQuantity(key, item.quantity + 1)}
            />
          </div>

          <PriceTag
            size="compacto"
            className="items-end text-right"
            cents={item.price * item.quantity}
            oldCents={item.oldPrice ? item.oldPrice * item.quantity : undefined}
          />
        </div>

        {/* Urgência real: o estoque acabou no que já está no carrinho. */}
        {item.quantity >= item.stock && (
          <p className="mt-2 text-xs font-medium text-oferta">
            {item.stock === 1
              ? "Última unidade em estoque"
              : `Últimas ${item.stock} unidades em estoque`}
          </p>
        )}

        <button
          type="button"
          onClick={() => removeItem(key)}
          aria-label={`Remover ${item.name} do carrinho`}
          className="mt-1 inline-flex min-h-8 items-center self-start text-xs font-medium text-ink-600 underline decoration-fio underline-offset-2 transition-colors duration-(--duracao-toque) hover:text-grafite-900 hover:decoration-grafite-900 pointer-coarse:min-h-11"
        >
          Remover
        </button>
      </div>
    </li>
  );
}

function QtyButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-9 items-center justify-center text-grafite-900 transition-colors duration-(--duracao-toque) hover:bg-papel disabled:cursor-not-allowed disabled:text-ink-300 disabled:hover:bg-transparent pointer-coarse:size-11"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
