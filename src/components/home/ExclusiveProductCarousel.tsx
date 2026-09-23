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
 * por vez, com as setas no cabeçalho. É um dos raros momentos de marca da loja:
 * letreiro em Bodoni, o selo "DG" em contorno de ouro e o fio de ouro sob o
 * cabeçalho. O preço é o mesmo preço-assinatura do card.
 */
export function ExclusiveProductCarousel({ products }: { products: ProdutoExclusivo[] }) {
  const [index, setIndex] = useState(0);

  if (!products.length) {
    return (
      <section
        aria-labelledby="exclusivos-titulo"
        className="flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-card border border-fio bg-white"
      >
        <Cabecalho />
        <p className="flex flex-1 items-center p-5 text-sm leading-relaxed text-ink-600">
          Os próximos produtos exclusivos aparecerão aqui.
        </p>
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
      aria-labelledby="exclusivos-titulo"
      aria-roledescription="carrossel"
      className="relative flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-card border border-fio bg-white"
    >
      <Cabecalho>
        {/* Setas sobre o grafite chapado: sem vidro, porque não há nada atrás para desfocar. */}
        {products.length > 1 && (
          <div className="flex shrink-0">
            <IconButton icon="seta-esquerda" label="Produto exclusivo anterior" variant="sobre-escuro" onClick={previous} />
            <IconButton icon="seta-direita" label="Próximo produto exclusivo" variant="sobre-escuro" onClick={next} />
          </div>
        )}
      </Cabecalho>

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
            // O poço é largo e baixo, e a foto é contida nele: quem manda no
            // tamanho exibido é a altura (cerca de 150 px, 190 px ao lado do
            // banner). O `sizes` segue isso, e não a largura da tela.
            <Image
              src={image.src}
              alt=""
              fill
              sizes="(max-width: 1023px) 12rem, 15rem"
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

/**
 * Cabeçalho grafite da linha própria, com o fio de ouro embaixo: o selo "DG"
 * em contorno de ouro (o emblema em vetor chapado, sem a folha de ouro da
 * arte raster) e o título em Bodoni. As ações entram à direita, com o foco em
 * ouro-claro, como no header: o ouro padrão fica em 3,2:1 no grafite.
 */
function Cabecalho({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-ouro bg-grafite-900 py-1.5 pl-4 pr-1.5 [--cor-foco:var(--color-ouro-claro)]">
      <div className="flex min-w-0 items-center gap-2.5">
        {/* Decorativo: o título ao lado já diz "Dom Guima". */}
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-pill border-[1.5px] border-ouro font-brand text-xs font-bold leading-none text-ouro-claro"
        >
          DG
        </span>
        {/* 1rem no celular: em 375 px o título inteiro cabe ao lado das
            setas. Abaixo disso ele quebra em duas linhas, e não é cortado. */}
        <h2 id="exclusivos-titulo" className="min-w-0 font-brand text-base font-semibold leading-tight text-ouro-claro sm:text-lg">
          Exclusivos Dom Guima
        </h2>
      </div>
      {children}
    </div>
  );
}
