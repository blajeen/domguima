"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { PriceTag } from "@/components/ui/PriceTag";
import type { Product, ProductImage } from "@/lib/catalog/types";
import { paymentLines } from "@/lib/utils/format";

/**
 * Só o que a linha mostra. A home monta isto no servidor, e descrição, ficha
 * técnica e tags não vão para o navegador (este componente é client).
 */
export type ProdutoExclusivo = Pick<
  Product,
  "id" | "slug" | "name" | "brand" | "price" | "oldPrice" | "cardInstallment"
> & { image: ProductImage | null };

/**
 * Linha própria "Exclusivos Dom Guima", ao lado do banner da home: um produto
 * por vez, com as setas no cabeçalho. É um dos raros momentos de marca da loja
 * (letreiro em Bodoni e fio de ouro); o preço é o mesmo preço-assinatura do card.
 */
export function ExclusiveProductCarousel({ products }: { products: ProdutoExclusivo[] }) {
  const [index, setIndex] = useState(0);

  if (!products.length) {
    return (
      <section className="flex min-h-[360px] flex-col justify-center rounded-card border-t border-ouro bg-grafite-900 p-7 text-papel">
        {/* Um título só, sem rótulo acima dele. */}
        <h2 className="text-balance font-brand text-titulo font-semibold text-ouro-claro">
          Exclusivos Dom Guima
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">Os próximos produtos exclusivos aparecerão aqui.</p>
      </section>
    );
  }

  const safeIndex = index % products.length;
  const product = products[safeIndex];
  const image = product.image;
  const href = `/produto/${product.slug}`;
  const previous = () => setIndex((current) => (current - 1 + products.length) % products.length);
  const next = () => setIndex((current) => (current + 1) % products.length);

  return (
    <section
      aria-label="Produtos exclusivos Dom Guima"
      aria-roledescription="carrossel"
      className="relative flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-card border border-fio bg-white"
    >
      <div className="flex items-center justify-between gap-3 border-b border-ouro bg-grafite-900 py-1.5 pl-4 pr-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Image src="/brand/logo-dom-guima.png" alt="" width={32} height={32} className="size-8 shrink-0 object-contain" />
          <h2 className="min-w-0 truncate font-brand text-lg font-semibold text-ouro-claro">Exclusivos Dom Guima</h2>
        </div>
        {/* Setas sobre o grafite chapado: sem vidro, porque não há nada atrás para desfocar. */}
        {products.length > 1 && (
          <div className="flex shrink-0">
            <IconButton icon="seta-esquerda" label="Produto exclusivo anterior" variant="sobre-escuro" onClick={previous} />
            <IconButton icon="seta-direita" label="Próximo produto exclusivo" variant="sobre-escuro" onClick={next} />
          </div>
        )}
      </div>

      <div
        key={product.id}
        role="group"
        aria-label={`${safeIndex + 1} de ${products.length}`}
        className="flex flex-1 flex-col motion-safe:animate-fade-up"
      >
        {/* Sem selo "Só na Dom Guima" na foto: o cabeçalho logo acima já diz isso.
            A foto repete o link do nome logo abaixo: fica fora do Tab e do
            leitor de tela, como no carrinho. */}
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden
          className="relative mx-4 mt-4 block min-h-32 flex-1 overflow-hidden rounded-card border border-fio bg-white"
        >
          {image && (
            <Image
              src={image.src}
              alt=""
              fill
              sizes="(max-width: 1023px) 90vw, 30vw"
              className="object-contain p-3"
            />
          )}
        </Link>

        <div className="px-4 pb-4 pt-3">
          <p className="text-xs text-ink-500">{product.brand || "Dom Guima"}</p>
          <Link
            href={href}
            className="line-clamp-2-safe mt-0.5 block text-sm font-medium leading-5 text-grafite-900 decoration-ouro underline-offset-2 hover:underline"
          >
            {product.name}
          </Link>
          <div className="mt-3 flex items-end justify-between gap-3">
            <PriceTag
              className="min-w-0"
              cents={product.price}
              oldCents={product.oldPrice}
              lines={paymentLines(product.price, product.cardInstallment)}
            />
            <ButtonLink href={href} size="sm" className="shrink-0">
              Ver produto
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
