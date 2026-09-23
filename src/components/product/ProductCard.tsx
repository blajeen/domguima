import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PriceTag } from "@/components/ui/PriceTag";
import { Rating } from "@/components/ui/Rating";
import { nomeFotoProduto } from "@/lib/catalog/apresentacao";
import type { Product } from "@/lib/catalog/types";
import type { CartProductInput } from "@/lib/store/cart-types";
import { discountPercent, paymentLines } from "@/lib/utils/format";
import { AddToCartButton } from "./AddToCartButton";

interface ProductCardProps {
  product: Product;
  /** Baixa a foto já, sem esperar a rolagem: só nos primeiros cards da tela. */
  eager?: boolean;
  /** Largura fixa quando dentro de carrossel. */
  fixedWidth?: boolean;
  /**
   * A foto "voa" até a galeria ao abrir o produto (View Transition). Só onde
   * o produto aparece uma vez na tela: dois elementos com o mesmo nome fazem o
   * navegador cancelar a transição.
   */
  transicaoFoto?: boolean;
}

/**
 * Card de produto. Server component: numa grade de 48 cards, só os botões de
 * "Adicionar" hidratam (AddToCartButton), não o card inteiro.
 *
 * Desenho: poço de foto branco, separação por fio de 1 px e nenhuma sombra. No
 * hover a borda escurece e o botão aparece; nada sobe nem cresce. A foto é a
 * do cadastro, do jeito que está: aqui só muda a moldura em volta dela.
 */
export function ProductCard({
  product,
  eager = false,
  fixedWidth = false,
  transicaoFoto = false,
}: ProductCardProps) {
  const href = `/produto/${product.slug}`;
  const image = product.images[0];
  const outOfStock = product.stock <= 0;
  // Com opção para escolher (voltagem, cor), o botão leva à página do produto:
  // do card não dá para saber qual opção o cliente quer.
  const needsChoice = Boolean(product.variantOptions?.length || product.variants?.length);
  const discount = discountPercent(product.price, product.oldPrice);
  const selo = seloDoCard(product, discount, outOfStock);
  const foto = image ? (
    <Image
      src={image.src}
      alt={image.alt}
      fill
      loading={eager ? "eager" : "lazy"}
      sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 232px"
      className={`object-contain p-3 ${outOfStock ? "opacity-45 grayscale" : ""}`}
    />
  ) : null;

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-card border border-fio bg-white transition-colors duration-(--duracao-toque) hover:border-grafite-900 ${
        fixedWidth
          ? "w-[46vw] max-w-[232px] sm:w-[224px] lg:w-full lg:max-w-none"
          : "w-full"
      }`}
    >
      {/* O contorno de foco fica por dentro: o card corta o que passa da borda. */}
      <Link href={href} className="flex flex-1 flex-col focus-visible:-outline-offset-2">
        <div className="relative aspect-square border-b border-fio bg-white">
          {foto ? (
            transicaoFoto ? (
              // default="none": a foto só anima no par com a galeria, nunca
              // sozinha em outra navegação.
              <ViewTransition name={nomeFotoProduto(product.id)} share="morph" default="none">
                {foto}
              </ViewTransition>
            ) : (
              foto
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
              <Image
                src="/brand/logo-dom-guima.png"
                alt=""
                width={48}
                height={48}
                className="size-12 object-contain opacity-30"
              />
              <span className="text-xs font-semibold text-ink-500">Foto em preparação</span>
            </div>
          )}

          {selo && <div className="absolute left-2 top-2">{selo}</div>}

          {outOfStock && (
            <p className="absolute inset-x-0 bottom-0 bg-grafite-900 py-1.5 text-center text-xs font-semibold text-papel">
              Indisponível
            </p>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3">
          {product.brand && <p className="text-xs text-ink-500">{product.brand}</p>}
          {/* Duas linhas sempre reservadas: os preços da mesma fileira alinham. */}
          <h3 className="line-clamp-2-safe mt-0.5 min-h-10 text-sm font-medium leading-5 text-grafite-900">
            {product.name}
          </h3>

          {/* Estrelas só com nota real. Nunca 5 estrelas vazias. */}
          {product.rating !== undefined && (
            <Rating value={product.rating} reviewCount={product.reviewCount} className="mt-1.5" />
          )}

          <PriceTag
            className="mt-3"
            cents={product.price}
            oldCents={product.oldPrice}
            lines={paymentLines(product.cardInstallment)}
          />
        </div>
      </Link>

      {/* Só com mouse (e nenhuma tela de toque), o botão aparece no hover ou
          quando o foco entra no card (teclado). Com toque, inclusive em
          notebook híbrido, ele fica sempre à vista. O espaço é reservado nos
          dois casos: a grade não pula. */}
      <div className="px-3 pb-3 transition-opacity duration-(--duracao-toque) group-focus-within:opacity-100 group-hover:opacity-100 so-mouse:opacity-0">
        {outOfStock ? (
          <Button size="sm" fullWidth disabled>
            Indisponível
          </Button>
        ) : needsChoice ? (
          <ButtonLink
            href={href}
            size="sm"
            fullWidth
            aria-label={`Escolher opções de ${product.name}`}
          >
            Escolher opções
          </ButtonLink>
        ) : (
          <AddToCartButton product={paraOCarrinho(product)} />
        )}
      </div>
    </article>
  );
}

/**
 * No máximo um selo por card, na ordem desconto > mais vendido > exclusivo.
 * O desconto já é o "−X%" colado ao preço: com desconto a foto fica sem selo,
 * para o card não repetir o número nem somar um segundo selo.
 */
function seloDoCard(product: Product, discount: number, outOfStock: boolean) {
  if (outOfStock || discount > 0) return null;
  if (product.isBestSeller) return <Badge variant="destaque">Mais vendido</Badge>;
  if (product.isExclusive) return <Badge variant="exclusivo">Só na Dom Guima</Badge>;
  return null;
}

/** Só o que o carrinho usa: descrição e ficha técnica não vão para o navegador. */
function paraOCarrinho(product: Product): CartProductInput {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    oldPrice: product.oldPrice,
    stock: product.stock,
    images: product.images[0] ? [{ src: product.images[0].src }] : [],
    shipping: { weight: product.shipping.weight },
  };
}
