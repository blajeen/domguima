"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { commerce } from "@/config/site";
import type { Product } from "@/lib/catalog/types";
import { productMessage, whatsappLink } from "@/lib/services/whatsapp";
import { useCart } from "@/lib/store/cart";
import {
  bestInstallment,
  discountPercent,
  formatPrice,
  pixPrice,
} from "@/lib/utils/format";

/**
 * Bloco de compra: variação, quantidade e as três formas de seguir —
 * carrinho, compra direta e WhatsApp (canal que a loja já usa hoje).
 */
export function ProductPurchase({
  product,
  productUrl,
}: {
  product: Product;
  productUrl: string;
}) {
  const router = useRouter();
  const { addItem, openCart } = useCart();

  const variantGroup = product.variants?.[0];
  const [variant, setVariant] = useState<string | undefined>(
    variantGroup?.options[0],
  );
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const outOfStock = product.stock <= 0;
  const discount = discountPercent(product.price, product.oldPrice);
  // Parcelamento real informado pelo lojista (com taxa) tem prioridade sobre
  // o cálculo "sem juros" — este site nunca promete uma condição melhor do
  // que a real.
  const installment = product.cardInstallment ?? bestInstallment(product.price);
  const pix = pixPrice(product.price);
  // Quando o lojista já informou o preço à vista/Pix diretamente (produtos da
  // lista de vendas), `price` JÁ É esse valor — não inflamos com um desconto
  // extra de Pix inventado por cima.
  const showPixDiscount = commerce.pixDiscountPercent > 0 && !product.cardInstallment;

  function add() {
    if (outOfStock) return;
    addItem(product, quantity, variant);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  function buyNow() {
    if (outOfStock) return;
    addItem(product, quantity, variant);
    router.push("/checkout");
  }

  return (
    <div className="space-y-5">
      {/* Preço */}
      <div>
        {product.oldPrice && (
          <p className="flex items-center gap-2">
            <span className="text-sm text-ink-400 line-through">
              {formatPrice(product.oldPrice)}
            </span>
            {discount > 0 && (
              <span className="rounded-md bg-promo px-2 py-0.5 text-xs font-extrabold text-white">
                -{discount}%
              </span>
            )}
          </p>
        )}
        <p className="mt-1 text-4xl font-extrabold tracking-tight text-ink-900">
          {formatPrice(product.price)}
        </p>
        {installment && (
          <p className="mt-1.5 text-sm text-ink-600">
            em até{" "}
            <strong className="font-bold">
              {installment.count}x de {formatPrice(installment.value)}
            </strong>{" "}
            {product.cardInstallment ? "no cartão (com taxa)" : "sem juros"}
          </p>
        )}
        {showPixDiscount && (
          <p className="mt-1 text-sm font-semibold text-success">
            {formatPrice(pix)} à vista no Pix ({commerce.pixDiscountPercent}% de
            desconto)
          </p>
        )}
        {product.cardInstallment && (
          <p className="mt-1 text-sm font-semibold text-success">
            {formatPrice(product.price)} à vista no Pix ou dinheiro
          </p>
        )}
      </div>

      {/* Disponibilidade */}
      <p className="flex items-center gap-2 text-sm">
        {outOfStock ? (
          <span className="font-semibold text-promo">
            ● Produto indisponível no momento
          </span>
        ) : product.stock <= 3 ? (
          <span className="font-semibold text-promo">
            {product.stock === 1
              ? "● Última unidade em estoque"
              : `● Últimas ${product.stock} unidades em estoque`}
          </span>
        ) : (
          <span className="font-semibold text-success">● Disponível em estoque</span>
        )}
      </p>

      {/* Variação */}
      {variantGroup && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-ink-900">
            {variantGroup.name}:{" "}
            <span className="font-medium text-ink-600">{variant}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {variantGroup.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setVariant(option)}
                aria-pressed={variant === option}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors ${
                  variant === option
                    ? "border-gold-400 bg-gold-50 text-gold-900"
                    : "border-ink-200 text-ink-600 hover:border-ink-400"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* Quantidade */}
      {!outOfStock && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-ink-900">Quantidade</span>
          <div className="flex items-center rounded-lg border border-ink-200">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Diminuir quantidade"
              className="flex h-10 w-10 items-center justify-center text-lg font-bold text-ink-600 transition-colors hover:bg-ink-50 disabled:text-ink-300"
            >
              −
            </button>
            <span className="min-w-10 text-center font-bold tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
              disabled={quantity >= product.stock}
              aria-label="Aumentar quantidade"
              className="flex h-10 w-10 items-center justify-center text-lg font-bold text-ink-600 transition-colors hover:bg-ink-50 disabled:text-ink-300"
            >
              +
            </button>
          </div>
          <span className="text-xs text-ink-400">
            {product.stock} {product.stock === 1 ? "disponível" : "disponíveis"}
          </span>
        </div>
      )}

      {/* Ações */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={buyNow}
          disabled={outOfStock}
          className="w-full rounded-xl bg-brand-700 px-6 py-3.5 text-base font-extrabold text-white transition-all hover:bg-brand-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-400"
        >
          {outOfStock ? "Indisponível" : "Comprar agora"}
        </button>

        <button
          type="button"
          onClick={added ? openCart : add}
          disabled={outOfStock}
          className={`w-full rounded-xl border-2 px-6 py-3 text-base font-bold transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:border-ink-100 disabled:text-ink-400 ${
            added
              ? "border-success bg-success-light text-success"
              : "border-brand-700 text-brand-800 hover:bg-brand-700 hover:text-white"
          }`}
        >
          {added ? "Adicionado ✓ Ver carrinho" : "Adicionar ao carrinho"}
        </button>

        <a
          href={whatsappLink(productMessage(product, productUrl))}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#25D366] px-6 py-3 text-base font-bold text-[#128C7E] transition-colors hover:bg-[#25D366]/10"
        >
          Comprar pelo WhatsApp
        </a>
      </div>
    </div>
  );
}
