/** Origem do registro — sempre explícita, nunca "meio real". */
export type DataSource =
  /** Importado da loja oficial na Shopee. IDs, preços, fotos e vendas reais. */
  | "shopee-verified"
  /**
   * Preço, marca, especificação e voltagem informados pelo próprio lojista
   * (lista de vendas usada no WhatsApp). Real, mas ainda sem foto do produto
   * em si — usa ilustração até a foto real ser adicionada.
   */
  | "loja-verified"
  /** Item de vitrine para desenvolvimento. Substituir por produto real. */
  | "placeholder";

export interface ProductImage {
  /** Caminho em /public ou URL absoluta. */
  src: string;
  alt: string;
}

export interface ProductVariant {
  /** Ex.: "Voltagem" */
  name: string;
  options: string[];
}

export interface Specification {
  label: string;
  value: string;
}

export interface Shipping {
  /** Gramas. Usado no cálculo de frete. */
  weight: number;
  /** Centímetros: comprimento x largura x altura. */
  dimensions: { length: number; width: number; height: number };
  /** Origem do envio. */
  origin: string;
}

export interface Product {
  id: string;
  /** ID na Shopee, quando o produto veio de lá. */
  externalId?: number;
  name: string;
  slug: string;
  description: string;
  /** Centavos. Evita erro de ponto flutuante em somas do carrinho. */
  price: number;
  /** Centavos. Preço "de" riscado. Ausente = sem desconto. */
  oldPrice?: number;
  categoryId: string;
  brand?: string;
  sku: string;
  stock: number;
  images: ProductImage[];
  variants?: ProductVariant[];
  specifications: Specification[];
  shipping: Shipping;
  /** 0–5. Ausente quando o produto ainda não tem avaliação real. */
  rating?: number;
  reviewCount?: number;
  /** Unidades vendidas. Ausente quando não há dado real. */
  soldCount?: number;
  isFeatured: boolean;
  isBestSeller: boolean;
  isOffer: boolean;
  /** Produto próprio ou exclusivo selecionado pelo gestor da Dom Guima. */
  isExclusive?: boolean;
  tags: string[];
  dataSource: DataSource;
  /** Link do anúncio original, quando existir. */
  sourceUrl?: string;
  /**
   * Parcelamento REAL no cartão, com a taxa da maquininha já embutida —
   * informado pelo lojista, não calculado. Quando presente, a UI mostra este
   * valor em vez do parcelamento "sem juros" computado, e não soma o desconto
   * genérico do Pix por cima: para estes produtos, `price` já É o preço à
   * vista no Pix/dinheiro, exatamente como o lojista informou.
   */
  cardInstallment?: { count: number; value: number };
  /** Observação pontual do lojista (ex.: "Entrega grátis em Uberlândia"). */
  sellerNote?: string;
  /** Data real de publicacao pelo painel. Ausente nos itens antigos importados. */
  publishedAt?: string;
  /** Ultima entrada de estoque registrada pelo painel. */
  lastStockEntryAt?: string;
  /** Ultima baixa marcada explicitamente como venda confirmada. */
  lastSaleAt?: string;
  /** Permite retirar o produto da curadoria automatica sem despublica-lo. */
  heroEnabled?: boolean;
  /** Ajuste editorial de -100 a 100 somado ao ranking automatico. */
  heroPriority?: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  /** Frase curta usada no topo da página de categoria e na meta description. */
  description: string;
  /** Fallback visual quando a categoria ainda não tem uma foto de produto. */
  icon: string;
  /** Ordem no menu principal. */
  order: number;
  /** Aparece no menu horizontal do desktop. */
  inMainMenu: boolean;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  /** Chave de tema para o gradiente — ver HeroBanner. */
  theme: "gold" | "ink" | "deep";
  /** Selo pequeno acima do título. Opcional. */
  eyebrow?: string;
  /** Categoria usada para escolher uma foto real do catálogo no banner. */
  categoryId: string;
  /** Foto resolvida pela home a partir do catálogo ativo. */
  image?: ProductImage;
  /** Cartao de prova social no lugar da foto de produto. */
  reputation?: {
    googleRating: number;
    googleCount: number;
    shopeeRating: number;
    shopeeCount: number;
    googleVerifiedAt: string;
    shopeeVerifiedAt: string;
  };
}

export type SortKey =
  | "relevancia"
  | "mais-vendidos"
  | "menor-preco"
  | "maior-preco"
  | "recentes";

export interface ProductFilters {
  categoryId?: string;
  query?: string;
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  onlyOffers?: boolean;
  onlyInStock?: boolean;
  sort?: SortKey;
}
