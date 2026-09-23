"use client";

import { CartLineItem } from "@/components/cart/CartLineItem";
import { CartTotals } from "@/components/cart/CartTotals";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/config/site";
import { lineKey, useCart } from "@/lib/store/cart";

/**
 * Carrinho em página cheia. Existe além da gaveta porque é o formato que o
 * cliente espera ao voltar de outra aba, e é o que funciona melhor no celular
 * na hora de revisar o pedido.
 */
export default function CartPage() {
  const { items, ready, subtotal, savings, count } = useCart();

  return (
    <div className="site-shell py-6">
      <Breadcrumbs
        items={[{ label: "Início", href: "/" }, { label: "Carrinho" }]}
        siteUrl={site.url}
      />

      <h1 className="mt-4 text-balance text-titulo-lg font-bold text-grafite-900 sm:text-4xl">
        Meu carrinho
        {ready && count > 0 && (
          <span className="ml-2 text-base font-medium text-ink-500">
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
          <p className="mt-4 text-xl font-bold text-grafite-900">
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
          {/* Uma folha só, com os itens separados por fio: sem uma caixa com
              sombra para cada item. */}
          <ul className="h-fit divide-y divide-fio rounded-card border border-fio bg-white">
            {items.map((item) => (
              <CartLineItem key={lineKey(item)} item={item} size="pagina" />
            ))}
          </ul>

          <aside className="lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:h-fit">
            <div className="rounded-card border border-fio bg-white p-5">
              <h2 className="mb-4 text-base font-bold text-grafite-900">
                Resumo do pedido
              </h2>
              <CartTotals
                items={items}
                subtotal={subtotal}
                savings={savings}
                shipping="Calculado na próxima etapa"
              />

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
