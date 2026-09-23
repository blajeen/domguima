import type { ProductFilters, SortKey } from "./types";

/**
 * Faixa do filtro de preço. `min`/`max` em centavos, os dois inclusivos (como
 * `queryProducts` compara); `max: null` = "acima de".
 */
export interface PriceRange {
  /** Valor de `?preco=` na URL, em reais inteiros: "ate-150", "150-300" ou "acima-600". */
  id: string;
  label: string;
  min: number;
  max: number | null;
}

const reaisInteiros = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function rangeFromReais(min: number | null, max: number | null): PriceRange {
  if (min === null && max !== null) {
    return { id: `ate-${max}`, label: `Até ${reaisInteiros.format(max)}`, min: 0, max: max * 100 };
  }
  if (min !== null && max === null) {
    return {
      id: `acima-${min}`,
      label: `Acima de ${reaisInteiros.format(min)}`,
      min: min * 100,
      max: null,
    };
  }
  const lo = min ?? 0;
  const hi = max ?? 0;
  return {
    id: `${lo}-${hi}`,
    label: `${reaisInteiros.format(lo)} a ${reaisInteiros.format(hi)}`,
    min: lo * 100,
    max: hi * 100,
  };
}

/**
 * Lê a faixa direto do id da URL. O id carrega os próprios limites, então um
 * link filtrado continua valendo mesmo que as faixas da listagem mudem; e os
 * ids das faixas fixas antigas ("ate-50", "50-150", "acima-600") seguem
 * funcionando do mesmo jeito.
 */
export function parsePriceRange(id?: string): PriceRange | null {
  if (!id) return null;
  const ate = /^ate-(\d{1,7})$/.exec(id);
  if (ate) return Number(ate[1]) > 0 ? rangeFromReais(null, Number(ate[1])) : null;
  const entre = /^(\d{1,7})-(\d{1,7})$/.exec(id);
  if (entre) {
    const [lo, hi] = [Number(entre[1]), Number(entre[2])];
    return lo < hi ? rangeFromReais(lo, hi) : null;
  }
  const acima = /^acima-(\d{1,7})$/.exec(id);
  if (acima) return rangeFromReais(Number(acima[1]), null);
  return null;
}

/**
 * Valor "de etiqueta" perto do dado: 47 → 45, 137 → 150, 2.730 → 2.500,
 * 8.200 → 8.000. O passo é meia casa decimal abaixo de 5 e uma casa a partir
 * de 5, com piso de R$ 1.
 */
function valorRedondo(reais: number): number {
  const casa = 10 ** Math.floor(Math.log10(Math.max(reais, 1)));
  const passo = Math.max(1, reais / casa < 5 ? casa / 2 : casa);
  return Math.max(passo, Math.round(reais / passo) * passo);
}

/** Quantil por interpolação linear, numa lista já ordenada. */
function quantil(ordenados: number[], q: number): number {
  const posicao = (ordenados.length - 1) * q;
  const base = Math.floor(posicao);
  const proximo = Math.min(base + 1, ordenados.length - 1);
  return ordenados[base] + (ordenados[proximo] - ordenados[base]) * (posicao - base);
}

/**
 * Faixas de preço tiradas da própria listagem: os quartis dos preços,
 * arredondados para valores redondos, dão até 4 faixas. Assim Smart TVs e
 * acessórios ganham faixas que fazem sentido para cada um, em vez de "Até
 * R$ 50" numa lista em que tudo passa de R$ 2.000.
 *
 * Toda faixa devolvida tem ao menos um produto. Com poucos produtos, ou todos
 * com o mesmo preço, não há o que filtrar e a lista sai vazia.
 */
export function priceRangesFor(products: { price: number }[]): PriceRange[] {
  const precos = products
    .map((product) => product.price)
    .filter((price) => price > 0)
    .sort((a, b) => a - b);
  if (precos.length < 4) return [];

  const menor = precos[0];
  const maior = precos[precos.length - 1];
  const cortes = [...new Set([0.25, 0.5, 0.75].map((q) => valorRedondo(quantil(precos, q) / 100)))]
    .filter((reais) => reais * 100 > menor && reais * 100 < maior)
    .sort((a, b) => a - b);

  // Faixa do meio sem produto (os preços pulam por cima dela): junta com a de
  // cima. A primeira e a última nunca ficam vazias, pelo filtro acima.
  const temProduto = (min: number, max: number) =>
    precos.some((price) => price >= min * 100 && price <= max * 100);
  for (let i = 0; i < cortes.length - 1; ) {
    if (temProduto(cortes[i], cortes[i + 1])) i++;
    else cortes.splice(i + 1, 1);
  }
  if (cortes.length === 0) return [];

  return [
    rangeFromReais(null, cortes[0]),
    ...cortes.slice(0, -1).map((corte, i) => rangeFromReais(corte, cortes[i + 1])),
    rangeFromReais(cortes[cortes.length - 1], null),
  ];
}

export interface FilterState {
  price?: string;
  brands: string[];
  onlyOffers: boolean;
  onlyInStock: boolean;
}

const SORT_KEYS: SortKey[] = [
  "relevancia",
  "mais-vendidos",
  "menor-preco",
  "maior-preco",
  "recentes",
];

export function parseSort(value: string | string[] | undefined): SortKey {
  const raw = Array.isArray(value) ? value[0] : value;
  return SORT_KEYS.includes(raw as SortKey) ? (raw as SortKey) : "relevancia";
}

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevancia", label: "Mais relevantes" },
  { value: "mais-vendidos", label: "Mais vendidos" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "recentes", label: "Mais recentes" },
];

/** Lê os filtros dos searchParams da rota. */
export function parseFilterState(
  params: Record<string, string | string[] | undefined>,
): FilterState {
  const marca = params.marca;
  // Faixa de preço que não se lê (link quebrado) é ignorada: não conta como
  // filtro ativo nem aparece marcada.
  const preco = typeof params.preco === "string" ? parsePriceRange(params.preco) : null;
  return {
    price: preco?.id,
    brands: Array.isArray(marca) ? marca : marca ? [marca] : [],
    onlyOffers: params.promo === "1",
    onlyInStock: params.disponivel === "1",
  };
}

export function priceRangeToBounds(id?: string): {
  minPrice?: number;
  maxPrice?: number;
} {
  const range = parsePriceRange(id);
  if (!range) return {};
  return {
    minPrice: range.min,
    ...(range.max !== null ? { maxPrice: range.max } : {}),
  };
}

/** Junta estado de filtro + ordenação no formato que `queryProducts` espera. */
export function toProductFilters(
  state: FilterState,
  sort: SortKey,
  extra: Partial<ProductFilters> = {},
): ProductFilters {
  return {
    ...priceRangeToBounds(state.price),
    brands: state.brands.length ? state.brands : undefined,
    onlyOffers: state.onlyOffers || undefined,
    onlyInStock: state.onlyInStock || undefined,
    sort,
    ...extra,
  };
}
