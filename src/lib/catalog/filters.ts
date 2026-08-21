import type { ProductFilters, SortKey } from "./types";

/** Faixas de preço em centavos. `max: null` = "acima de". */
export const PRICE_RANGES = [
  { id: "ate-50", label: "Até R$ 50", min: 0, max: 5000 },
  { id: "50-150", label: "R$ 50 a R$ 150", min: 5000, max: 15000 },
  { id: "150-300", label: "R$ 150 a R$ 300", min: 15000, max: 30000 },
  { id: "300-600", label: "R$ 300 a R$ 600", min: 30000, max: 60000 },
  { id: "acima-600", label: "Acima de R$ 600", min: 60000, max: null },
] as const;

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
  return {
    price: typeof params.preco === "string" ? params.preco : undefined,
    brands: Array.isArray(marca) ? marca : marca ? [marca] : [],
    onlyOffers: params.promo === "1",
    onlyInStock: params.disponivel === "1",
  };
}

export function priceRangeToBounds(id?: string): {
  minPrice?: number;
  maxPrice?: number;
} {
  const range = PRICE_RANGES.find((r) => r.id === id);
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
