import { normalize } from "@/lib/utils/format";
import { loadCatalogCategories, loadCatalogProducts } from "./database";
import type { Category, Product, ProductFilters, SortKey } from "./types";

export async function getAllProducts(): Promise<Product[]> { return loadCatalogProducts(); }
export async function getProductBySlug(slug: string): Promise<Product | undefined> { return (await loadCatalogProducts()).find((product) => product.slug === slug); }
export async function getProductsByCategory(categoryId: string): Promise<Product[]> { return (await loadCatalogProducts()).filter((product) => product.categoryId === categoryId); }

export async function getOffers(limit?: number): Promise<Product[]> {
  const list = (await loadCatalogProducts()).filter((product) => product.isOffer && product.oldPrice && product.oldPrice > product.price).sort((a, b) => (b.oldPrice! - b.price) / b.oldPrice! - (a.oldPrice! - a.price) / a.oldPrice!);
  return limit ? list.slice(0, limit) : list;
}

export async function getBestSellers(limit?: number): Promise<Product[]> {
  const list = (await loadCatalogProducts()).filter((product) => product.isBestSeller).sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0));
  return limit ? list.slice(0, limit) : list;
}

export async function getFeatured(limit?: number): Promise<Product[]> {
  const list = (await loadCatalogProducts()).filter((product) => product.isFeatured);
  return limit ? list.slice(0, limit) : list;
}

export async function getExclusiveProducts(limit = 8): Promise<Product[]> {
  return (await loadCatalogProducts())
    .filter((product) => product.isExclusive && product.stock > 0 && Boolean(product.images[0]))
    .slice(0, limit);
}

export async function getHomeSelection(limit = 12): Promise<Product[]> {
  const [products, categories] = await Promise.all([loadCatalogProducts(), loadCatalogCategories()]);
  return collectByCategories(products, categories.map((category) => category.id), limit);
}

export async function getHomeCollection(categoryIds: string[], limit = 12, excludeIds: ReadonlySet<string> = new Set()): Promise<Product[]> { return collectByCategories(await loadCatalogProducts(), categoryIds, limit, excludeIds); }
export async function getCategoryCoverProduct(categoryId: string): Promise<Product | undefined> { return (await loadCatalogProducts()).filter((product) => product.categoryId === categoryId && product.stock > 0 && Boolean(product.images[0])).sort((a, b) => b.price - a.price)[0]; }

function collectByCategories(products: Product[], categoryIds: string[], limit: number, excludeIds: ReadonlySet<string> = new Set()): Product[] {
  const queues = categoryIds.map((categoryId) => products.filter((product) => product.categoryId === categoryId && product.stock > 0 && Boolean(product.images[0]) && !excludeIds.has(product.id)).sort((a, b) => b.price - a.price));
  const result: Product[] = [];
  let depth = 0;
  while (result.length < limit && queues.some((queue) => depth < queue.length)) {
    for (const queue of queues) { const product = queue[depth]; if (product) result.push(product); if (result.length === limit) break; }
    depth += 1;
  }
  return result;
}

export async function getRelatedProducts(product: Product, limit = 6): Promise<Product[]> {
  const products = await loadCatalogProducts();
  const sameCategory = products.filter((item) => item.id !== product.id && item.categoryId === product.categoryId);
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit);
  const tags = new Set(product.tags);
  const byTag = products.filter((item) => item.id !== product.id && item.categoryId !== product.categoryId && item.tags.some((tag) => tags.has(tag)));
  return [...sameCategory, ...byTag].slice(0, limit);
}

export function getBrands(list: Product[]): string[] { return [...new Set(list.flatMap((product) => product.brand ? [product.brand] : []))].sort((a, b) => a.localeCompare(b, "pt-BR")); }
export function getPriceRange(list: Product[]): { min: number; max: number } { return list.length ? { min: Math.min(...list.map((product) => product.price)), max: Math.max(...list.map((product) => product.price)) } : { min: 0, max: 0 }; }

function scoreProduct(product: Product, terms: string[], categoryMap: Map<string, Category>): number {
  const name = normalize(product.name), category = normalize(categoryMap.get(product.categoryId)?.name ?? ""), brand = normalize(product.brand ?? ""), tags = product.tags.map(normalize), description = normalize(product.description);
  let score = 0;
  for (const term of terms) {
    let termScore = 0;
    if (name.startsWith(term)) termScore += 12; else if (name.includes(term)) termScore += 8;
    if (tags.some((tag) => tag === term)) termScore += 6; else if (tags.some((tag) => tag.includes(term))) termScore += 3;
    if (brand.includes(term)) termScore += 5;
    if (category.includes(term)) termScore += 4;
    if (description.includes(term)) termScore += 1;
    if (!termScore) return 0;
    score += termScore;
  }
  return score + Number(product.isBestSeller) + Number(product.isOffer);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const [products, categories] = await Promise.all([loadCatalogProducts(), loadCatalogCategories()]);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  return products.map((product) => ({ product, score: scoreProduct(product, terms, categoryMap) })).filter((result) => result.score > 0).sort((a, b) => b.score - a.score).map((result) => result.product);
}

export interface Suggestion { type: "produto" | "categoria"; label: string; href: string; image?: string; price?: number; }
export async function getSuggestions(query: string, limit = 6): Promise<Suggestion[]> {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const categories = await loadCatalogCategories();
  const categoryHits: Suggestion[] = categories.filter((category) => terms.every((term) => normalize(category.name).includes(term))).slice(0, 2).map((category) => ({ type: "categoria", label: category.name, href: `/categoria/${category.slug}` }));
  const productHits = (await searchProducts(query)).slice(0, limit - categoryHits.length).map((product) => ({ type: "produto" as const, label: product.name, href: `/produto/${product.slug}`, image: product.images[0]?.src, price: product.price }));
  return [...categoryHits, ...productHits];
}

function sortProducts(list: Product[], sort: SortKey): Product[] {
  const sorted = [...list];
  if (sort === "menor-preco") return sorted.sort((a, b) => a.price - b.price);
  if (sort === "maior-preco") return sorted.sort((a, b) => b.price - a.price);
  if (sort === "mais-vendidos") return sorted.sort((a, b) => Number(b.isBestSeller) - Number(a.isBestSeller) || (b.soldCount ?? 0) - (a.soldCount ?? 0));
  if (sort === "recentes") return sorted;
  return sorted.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || Number(b.isBestSeller) - Number(a.isBestSeller) || Number(b.isOffer) - Number(a.isOffer));
}

export async function queryProducts(filters: ProductFilters): Promise<Product[]> {
  let list = filters.query ? await searchProducts(filters.query) : [...await loadCatalogProducts()];
  if (filters.categoryId) list = list.filter((product) => product.categoryId === filters.categoryId);
  if (filters.brands?.length) { const brands = new Set(filters.brands); list = list.filter((product) => product.brand && brands.has(product.brand)); }
  if (filters.minPrice !== undefined) list = list.filter((product) => product.price >= filters.minPrice!);
  if (filters.maxPrice !== undefined) list = list.filter((product) => product.price <= filters.maxPrice!);
  if (filters.onlyOffers) list = list.filter((product) => product.isOffer && product.oldPrice && product.oldPrice > product.price);
  if (filters.onlyInStock) list = list.filter((product) => product.stock > 0);
  const sort = filters.sort ?? "relevancia";
  return filters.query && sort === "relevancia" ? list : sortProducts(list, sort);
}

export async function getCatalogCategories(): Promise<Category[]> { return loadCatalogCategories(); }
export { SORT_OPTIONS } from "./filters";
