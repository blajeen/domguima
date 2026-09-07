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
}

/** Produto + variação são linhas distintas no carrinho (110V não é 220V). */
export function lineKey(item: Pick<CartItem, "productId" | "variant" | "variantId">): string {
  const opcao = item.variantId ?? item.variant;
  return opcao ? `${item.productId}::${opcao}` : item.productId;
}
