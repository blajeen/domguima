import type { Installment } from "@/lib/utils/format";

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

/** Opcao vendavel: e ela que tem preco e estoque, nao o produto. */
export interface ProductVariantOption {
  id: string;
  label: string;
  sku: string;
  /** Centavos. */
  price: number;
  stock: number;
  /** Foto desta opcao. Ausente = usa a imagem principal do produto. */
  image?: string;
  /** Parcelado calculado sobre o preco DESTA opcao (ver Product.cardInstallment). */
  cardInstallment?: Installment;
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
  /** Nome do eixo quando o produto tem variacoes com estoque proprio. */
  variantAxis?: string;
  /**
   * Opcoes vendaveis, cada uma com preco e estoque proprios. Quando existe,
   * `price` e o menor preco entre elas e `stock` e a soma.
   */
  variantOptions?: ProductVariantOption[];
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
   * A chamada do cartão junto do preço ("em até Nx de R$ X"), CALCULADA sobre
   * `price` com a tabela da maquininha das Configurações, com a taxa
   * repassada (`parcelamentoMaximo`, aplicado em `comParcelamento`, em
   * lib/catalog/database.ts). `price` é sempre o preço à vista no Pix ou
   * dinheiro, o único que o lojista cadastra. Ausente quando a tabela só tem 1x.
   */
  cardInstallment?: Installment;
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

/** Slide do banner da home: um produto do catálogo, com o preço dele. */
export interface Banner {
  id: string;
  /** Nome do produto, como está no cadastro. */
  title: string;
  /**
   * Linha de fato abaixo do título: a categoria e, quando a data registrada
   * pelo painel confirma, "novo no catálogo" ou "estoque reposto".
   */
  detail: string;
  ctaLabel: string;
  href: string;
  /** Foto principal do produto, do jeito que está no cadastro. */
  image?: ProductImage;
  /** Preço do produto, para o preço-assinatura do banner. */
  price: Pick<Product, "price" | "oldPrice" | "cardInstallment">;
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
