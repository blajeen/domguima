"use client";

import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/config/site";
import { lineKey, useCart } from "@/lib/store/cart";
import { formatPrice } from "@/lib/utils/format";

/**
 * Carrinho em página cheia. Existe além da gaveta porque é o formato que o
 * cliente espera ao voltar de outra aba, e é o que funciona melhor no celular
 * na hora de revisar o pedido.
 */
export default function CartPage() {
  const { items, ready, subtotal, savings, setQuantity, removeItem, count } =
    useCart();

  return (
    <div className="site-shell py-6">
      <Breadcrumbs
        items={[{ label: "Início", href: "/" }, { label: "Carrinho" }]}
        siteUrl={site.url}
      />

      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
        Meu carrinho
        {ready && count > 0 && (
          <span className="ml-2 text-base font-medium text-ink-400">
            ({count} {count === 1 ? "item" : "itens"})
          </span>
        )}
      </h1>

      {!ready ? (
        <div className="mt-8 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-28 rounded-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-card border border-fio bg-white px-6 py-16 text-center">
          <Icon name="carrinho" size={40} className="mx-auto text-ink-400" />
          <p className="mt-4 text-xl font-bold text-ink-900">
            Seu carrinho está vazio
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-500">
            Dá uma olhada nas ofertas. Tem bastante coisa com desconto.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/ofertas" size="lg">
              Ver ofertas
            </ButtonLink>
            <ButtonLink href="/mais-vendidos" variant="secundario" size="lg">
              Mais vendidos
            </ButtonLink>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
          <ul className="space-y-3">
            {items.map((item) => {
              const key = lineKey(item);
              return (
                <li
                  key={key}
                  className="flex gap-4 rounded-card border border-ink-100 bg-white p-4 shadow-card"
                >
                  <Link href={`/produto/${item.slug}`} className="shrink-0">
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={96}
                      height={96}
                      className="h-20 w-20 rounded-lg border border-ink-100 object-contain sm:h-24 sm:w-24"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/produto/${item.slug}`}
                      className="line-clamp-2-safe text-sm font-semibold text-ink-800 hover:text-gold-800 sm:text-base"
                    >
                      {item.name}
                    </Link>
                    {item.variant && (
                      <p className="mt-0.5 text-xs text-ink-400">
                        {item.variant}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-ink-500">
                      {formatPrice(item.price)} cada
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center rounded-lg border border-ink-200">
                        <button
                          type="button"
                          onClick={() => setQuantity(key, item.quantity - 1)}
                          aria-label={`Diminuir quantidade de ${item.name}`}
                          className="flex h-9 w-9 items-center justify-center text-base font-bold text-ink-600 transition-colors hover:bg-ink-50"
                        >
                          −
                        </button>
                        <span className="min-w-9 text-center text-sm font-bold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(key, item.quantity + 1)}
                          disabled={item.quantity >= item.stock}
                          aria-label={`Aumentar quantidade de ${item.name}`}
                          className="flex h-9 w-9 items-center justify-center text-base font-bold text-ink-600 transition-colors hover:bg-ink-50 disabled:text-ink-300"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex items-center gap-4">
                        <p className="text-base font-extrabold text-ink-900">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeItem(key)}
                          className="text-xs font-medium text-ink-400 underline-offset-2 transition-colors hover:text-promo hover:underline"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:h-fit">
            <div className="rounded-card border border-ink-100 bg-white p-5 shadow-card">
              <h2 className="mb-4 text-base font-extrabold text-ink-900">
                Resumo do pedido
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between text-ink-600">
                  <dt>Subtotal</dt>
                  <dd>{formatPrice(subtotal)}</dd>
                </div>
                {savings > 0 && (
                  <div className="flex justify-between font-semibold text-success">
                    <dt>Você economiza</dt>
                    <dd>−{formatPrice(savings)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-ink-600">
                  <dt>Frete</dt>
                  <dd className="text-ink-400">Calculado na próxima etapa</dd>
                </div>
                <div className="flex justify-between border-t border-ink-100 pt-3 text-lg font-extrabold text-ink-900">
                  <dt>Total</dt>
                  <dd>{formatPrice(subtotal)}</dd>
                </div>
              </dl>

              {/* O pedido rápido termina no WhatsApp do vendedor: por isso o verde. */}
              <ButtonLink href="/checkout/rapido" variant="whatsapp" size="lg" fullWidth className="mt-5">
                Finalizar rápido com vendedor
              </ButtonLink>
              <p className="mt-2 text-center text-xs leading-relaxed text-ink-500">Só seu nome. Ideal para entrega em Uberlândia.</p>

              <ButtonLink href="/checkout" variant="secundario" fullWidth className="mt-3">
                Checkout completo
              </ButtonLink>

              <ButtonLink href="/" variant="fantasma" size="sm" fullWidth className="mt-2">
                Continuar comprando
              </ButtonLink>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
