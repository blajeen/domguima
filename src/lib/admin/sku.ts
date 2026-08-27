import type { AdminCategoryRow, AdminProductRow } from "./types";

const DEFAULT_PREFIXES: Record<string, string> = {
  "smart-tvs": "TV",
  celulares: "CEL",
  eletrodomesticos: "ELD",
  climatizacao: "CLM",
  eletronicos: "ELT",
  informatica: "INF",
  ferramentas: "FER",
  "casa-decoracao": "CSA",
  beleza: "BLZ",
};

export interface CategorySkuChoice {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  prefix: string;
  productCount: number;
  lastSku: string | null;
  nextSku: string;
}

export function buildCategorySkuChoices(categories: AdminCategoryRow[], products: AdminProductRow[]): CategorySkuChoice[] {
  return categories.filter((category) => category.active).map((category) => {
    const categoryProducts = products.filter((product) => product.category_id === category.id);
    const prefix = inferCategoryPrefix(category, categoryProducts);
    const sequence = products
      .map((product) => parseSku(product.sku))
      .filter((sku): sku is { prefix: string; sequence: number } => Boolean(sku) && sku!.prefix === prefix)
      .reduce((largest, sku) => Math.max(largest, sku.sequence), 0);
    return {
      categoryId: category.id,
      categoryName: category.name,
      categoryIcon: category.icon,
      prefix,
      productCount: categoryProducts.filter((product) => product.status !== "archived").length,
      lastSku: sequence > 0 ? formatSku(prefix, sequence) : null,
      nextSku: formatSku(prefix, sequence + 1),
    };
  });
}

function inferCategoryPrefix(category: AdminCategoryRow, products: AdminProductRow[]): string {
  const frequencies = new Map<string, number>();
  for (const product of products) {
    const parsed = parseSku(product.sku);
    if (parsed) frequencies.set(parsed.prefix, (frequencies.get(parsed.prefix) ?? 0) + 1);
  }
  const existing = [...frequencies.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  if (existing) return existing;
  return DEFAULT_PREFIXES[category.id] ?? derivePrefix(category.name);
}

function parseSku(value: string): { prefix: string; sequence: number } | null {
  const match = value.trim().toUpperCase().match(/^DG-([A-Z0-9]{2,8})-(\d+)$/);
  if (!match) return null;
  const sequence = Number(match[2]);
  return Number.isSafeInteger(sequence) && sequence > 0 ? { prefix: match[1], sequence } : null;
}

function derivePrefix(name: string): string {
  const words = name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const meaningful = words.filter((word) => !["A", "AS", "DA", "DAS", "DE", "DO", "DOS", "E"].includes(word));
  if (meaningful.length >= 2) return meaningful.map((word) => word[0]).join("").slice(0, 4);
  return (meaningful[0] ?? "PRODUTO").slice(0, 3).padEnd(2, "X");
}

function formatSku(prefix: string, sequence: number): string {
  return `DG-${prefix}-${String(sequence).padStart(3, "0")}`;
}
