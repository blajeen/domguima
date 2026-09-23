import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";
import { CarouselRow } from "@/components/ui/CarouselRow";
import { PriceTag } from "@/components/ui/PriceTag";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { nomeFotoProduto } from "@/lib/catalog/apresentacao";
import type { Product } from "@/lib/catalog/types";
import { paymentLines } from "@/lib/utils/format";

/**
 * Ofertas da home em forma de cartaz: foto à esquerda e o preço grande à
 * direita, com o preço "de" riscado e o −X%. Quebra o ritmo das vitrines de
 * card (é a "faixa de preço" da página) e mostra o que a loja é: empório de
 * ofertas. Só entram produtos com preço anterior maior que o atual (getOffers).
 *
 * O item inteiro é um link para o produto. Sem botão de adicionar: quem quer
 * comprar direto tem o card nas outras vitrines e a página do produto.
 */
export function FaixaDeOfertas({
  products,
  repetidos,
}: {
  products: Product[];
  /** Produtos que também aparecem em outra vitrine da tela: ficam sem a transição da foto. */
  repetidos?: ReadonlySet<string>;
}) {
  if (products.length === 0) return null;

  return (
    <section aria-labelledby="ofertas-titulo">
      <SectionHeader id="ofertas-titulo" title="Ofertas" href="/ofertas" linkLabel="Ver todas" />
      {/* Colunas do trilho no mesmo vão do CarouselRow (gap-3, gap-4 a partir
          de sm): um cartaz e a ponta do próximo no celular, 2 no tablet, 3 no
          desktop e 4 em tela larga. Sem nada fixo em altura: numa fileira os
          cartazes ficam com a altura do maior. */}
      <CarouselRow
        ariaLabel="Ofertas"
        className="auto-cols-[85%] sm:auto-cols-[calc((100%-1rem)/2)] lg:auto-cols-[calc((100%-2rem)/3)] 2xl:auto-cols-[calc((100%-3rem)/4)]"
      >
        {products.map((product) => (
          <Cartaz key={product.id} product={product} transicaoFoto={!repetidos?.has(product.id)} />
        ))}
      </CarouselRow>
    </section>
  );
}

function Cartaz({ product, transicaoFoto }: { product: Product; transicaoFoto: boolean }) {
  const image = product.images[0];
  const foto = image ? (
    // No celular a foto fica num poço 4:3 contido pela altura (cerca de
    // 13rem); do sm em diante, na coluna de 42% do cartaz.
    <Image
      src={image.src}
      alt={image.alt}
      fill
      sizes="(max-width: 639px) 13rem, (max-width: 1023px) 21vw, (max-width: 1535px) 14vw, 11vw"
      className="object-contain p-3"
    />
  ) : null;

  return (
    <article className="h-full overflow-hidden rounded-card border border-fio bg-white transition-colors duration-(--duracao-toque) hover:border-grafite-900">
      {/* O contorno de foco fica por dentro: o cartaz corta o que passa da borda.
          No celular a foto vai em cima: ao lado dela, o preço grande não
          caberia na largura que sobra. */}
      <Link href={`/produto/${product.slug}`} className="flex h-full flex-col focus-visible:-outline-offset-2 sm:flex-row">
        <div className="relative aspect-[4/3] w-full shrink-0 border-b border-fio bg-white sm:aspect-auto sm:w-[42%] sm:border-b-0 sm:border-r">
          {foto &&
            (transicaoFoto ? (
              // Mesmo par do card: a foto "voa" até a galeria do produto.
              <ViewTransition name={nomeFotoProduto(product.id)} share="morph" default="none">
                {foto}
              </ViewTransition>
            ) : (
              foto
            ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div className="min-w-0">
            {product.brand && <p className="text-xs text-ink-500">{product.brand}</p>}
            <h3 className="line-clamp-2-safe mt-0.5 text-sm font-medium leading-5 text-grafite-900">
              {product.name}
            </h3>
          </div>
          <PriceTag
            className="mt-auto"
            size="destaque"
            cents={product.price}
            oldCents={product.oldPrice}
            lines={paymentLines(product.cardInstallment)}
          />
        </div>
      </Link>
    </article>
  );
}
