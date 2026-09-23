import type { ProductVariantOption } from "@/lib/catalog/types";

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  /** centavos */
  price: number;
  /** centavos — usado para calcular a economia total */
  oldPrice?: number;
  quantity: number;
  stock: number;
  /** gramas — usado no cálculo de frete */
  weight: number;
  /** Ex.: "110V" */
  variant?: string;
  /**
   * Id da opcao quando ela tem estoque e preco proprios. E o que o pedido usa
   * para dar baixa na cor certa; `variant` sozinho e so o rotulo exibido.
   */
  variantId?: string;
  /**
   * Parcelamento real no cartão (com taxa) que o lojista informou para este
   * preço, para o total do carrinho repetir a frase do card. `null`: o produto
   * não tem (vale o Pix com desconto). Ausente: linha salva antes deste campo,
   * ou opção com preço próprio; aí o carrinho não afirma condição nenhuma.
   */
  cardInstallment?: { count: number; value: number } | null;
}

/**
 * O que o carrinho precisa do produto para criar a linha. Um `Product` inteiro
 * serve; o card de produto manda só isto, para não levar descrição e ficha
 * técnica de cada card para o navegador.
 */
export interface CartProductInput {
  id: string;
  slug: string;
  name: string;
  /** centavos */
  price: number;
  oldPrice?: number;
  stock: number;
  images: { src: string }[];
  shipping: { weight: number };
  variantOptions?: ProductVariantOption[];
  cardInstallment?: { count: number; value: number };
}

/** Produto + variação são linhas distintas no carrinho (110V não é 220V). */
export function lineKey(item: Pick<CartItem, "productId" | "variant" | "variantId">): string {
  const opcao = item.variantId ?? item.variant;
  return opcao ? `${item.productId}::${opcao}` : item.productId;
}
