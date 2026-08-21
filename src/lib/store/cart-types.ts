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
}

/** Produto + variação são linhas distintas no carrinho (110V não é 220V). */
export function lineKey(item: Pick<CartItem, "productId" | "variant">): string {
  return item.variant ? `${item.productId}::${item.variant}` : item.productId;
}
