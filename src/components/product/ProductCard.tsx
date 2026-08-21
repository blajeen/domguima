"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Rating } from "@/components/ui/Rating";
import type { Product } from "@/lib/catalog/types";
import { useCart } from "@/lib/store/cart";
import { bestInstallment, discountPercent, formatPrice } from "@/lib/utils/format";

interface ProductCardProps {
  product: Product;
  /** Prioriza o download da imagem — use nos primeiros cards da tela. */
  priority?: boolean;
  /** Largura fixa quando dentro de carrossel. */
  fixedWidth?: boolean;
}

export function ProductCard({
  product,
  priority = false,
  fixedWidth = false,
}: ProductCardProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const discount = discountPercent(product.price, product.oldPrice);
  // Parcelamento real informado pelo lojista (com taxa) tem prioridade sobre
  // o cálculo "sem juros" — não inventamos condição melhor do que a real.
  const installment = product.cardInstallment ?? bestInstallment(product.price);
  const outOfStock = product.stock <= 0;
  const image = product.images[0];

  function handleAdd(event: React.MouseEvent) {
    // O card inteiro é um link: impede a navegação ao clicar em "Adicionar".
    event.preventDefault();
    event.stopPropagation();
    if (outOfStock) return;

    // Produto com variação precisa de escolha — manda para a página dele.
    if (product.variants?.length) {
      router.push(`/produto/${product.slug}`);
      return;
    }

    addItem(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
  }

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-card border border-ink-100 bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-200 hover:shadow-card-hover ${
        fixedWidth
          ? "w-[46vw] max-w-[232px] sm:w-[224px] lg:w-full lg:max-w-none"
          : "w-full"
      }`}
    >
      <Link
        href={`/produto/${product.slug}`}
        className="flex flex-1 flex-col focus-visible:outline-none"
      >
        <div className="relative aspect-square overflow-hidden bg-white">
          {image && (
            <Image
              src={image.src}
              alt={image.alt}
              fill
              preload={priority}
              loading={priority ? undefined : "lazy"}
              sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 232px"
              className={`object-contain p-3 transition-transform duration-300 group-hover:scale-[1.04] ${
                outOfStock ? "opacity-45 grayscale" : ""
              }`}
            />
          )}

          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {discount > 0 && <Badge variant="promo">-{discount}%</Badge>}
            {product.isBestSeller && !outOfStock && (
              <Badge variant="best">Mais vendido</Badge>
            )}
          </div>

          {outOfStock && (
            <div className="absolute inset-x-0 bottom-0 bg-ink-900/85 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-white">
              Indisponível
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 border-t border-ink-50 p-3">
          {product.brand && (
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">
              {product.brand}
            </p>
          )}
          <h3 className="line-clamp-2-safe min-h-[2.5rem] text-[13px] font-medium leading-tight text-ink-700 transition-colors group-hover:text-brand-700 sm:text-sm">
            {product.name}
          </h3>

          {/* Estrelas só aparecem com nota real. Nunca 5 estrelas vazias. */}
          {product.rating !== undefined && (
            <Rating value={product.rating} reviewCount={product.reviewCount} />
          )}

          <div className="mt-auto pt-1">
            {product.oldPrice && (
              <p className="text-xs text-ink-400 line-through">
                {formatPrice(product.oldPrice)}
              </p>
            )}
            <div className="flex flex-wrap items-baseline gap-x-1">
              <p className="text-lg font-extrabold leading-tight tracking-tight text-ink-900">
                {formatPrice(product.price)}
              </p>
              <span className="text-[10px] font-medium text-ink-400">à vista</span>
            </div>
            {installment && (
              <p className="mt-0.5 text-xs text-ink-500">
                ou {installment.count}x de{" "}
                <span className="font-semibold text-ink-700">
                  {formatPrice(installment.value)}
                </span>
                {product.cardInstallment && " (com taxa)"}
              </p>
            )}
          </div>
        </div>
      </Link>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={handleAdd}
          disabled={outOfStock}
          aria-label={
            product.variants?.length
              ? `Escolher opções de ${product.name}`
              : `Adicionar ${product.name} ao carrinho`
          }
          className={`w-full rounded-lg px-3 py-2 text-sm font-bold transition-all duration-200 ${
            outOfStock
              ? "cursor-not-allowed bg-ink-100 text-ink-400"
              : justAdded
                ? "bg-success text-white"
                : "bg-brand-700 text-white hover:bg-brand-600 active:scale-[0.98]"
          }`}
        >
          {outOfStock
            ? "Indisponível"
            : justAdded
              ? "Adicionado ✓"
              : product.variants?.length
                ? "Escolher opções"
                : "Adicionar"}
        </button>
      </div>
    </article>
  );
}
