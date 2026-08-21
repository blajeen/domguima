import "server-only";

import { readCatalogState } from "@/lib/admin/catalog-store";
import { defaultStoreSettings } from "@/lib/admin/defaults";
import { categories as fallbackCategories } from "./categories";
import { products as fallbackProducts } from "./products";
import type { Category, Product, ProductImage } from "./types";
import type { StoreSettings } from "@/lib/admin/types";

export async function loadCatalogProducts(): Promise<Product[]> {
  try {
    const state = await readCatalogState();
    if (!state.catalogEnabled) return fallbackProducts;
    const products = state.products.filter((product) => product.status === "active");
    return products.length ? products.map((row) => toProduct(row as unknown as Record<string, unknown>)) : fallbackProducts;
  } catch { return fallbackProducts; }
}

export async function loadCatalogCategories(): Promise<Category[]> {
  try {
    const state = await readCatalogState();
    if (!state.catalogEnabled) return fallbackCategories;
    const categories = state.categories.filter((category) => category.active).sort((a, b) => a.sort_order - b.sort_order);
    return categories.length ? categories.map((row) => ({ id: row.id, name: row.name, slug: row.slug, description: row.description, icon: row.icon, order: row.sort_order, inMainMenu: row.in_main_menu })) : fallbackCategories;
  } catch { return fallbackCategories; }
}

export async function loadPublicStoreSettings(): Promise<StoreSettings> {
  try {
    return { ...defaultStoreSettings, ...(await readCatalogState()).settings };
  } catch { return defaultStoreSettings; }
}

function toProduct(row: Record<string, unknown>): Product {
  const imageRows = (Array.isArray(row.product_images) ? row.product_images : []) as Array<Record<string, unknown>>;
  const images: ProductImage[] = imageRows.sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) || Number(a.sort_order) - Number(b.sort_order)).map((image) => ({ src: String(image.src), alt: String(image.alt ?? row.name) }));
  const shipping = (row.shipping ?? {}) as Product["shipping"];
  return {
    id: String(row.id), ...(row.external_id != null ? { externalId: Number(row.external_id) } : {}), name: String(row.name), slug: String(row.slug), description: String(row.description ?? ""), price: Number(row.price_cents), ...(row.old_price_cents != null ? { oldPrice: Number(row.old_price_cents) } : {}), categoryId: String(row.category_id), ...(row.brand ? { brand: String(row.brand) } : {}), sku: String(row.sku), stock: Number(row.stock), images,
    variants: Array.isArray(row.variants) ? row.variants as Product["variants"] : [], specifications: Array.isArray(row.specifications) ? row.specifications as Product["specifications"] : [],
    shipping: { weight: Number(shipping?.weight ?? 0), dimensions: { length: Number(shipping?.dimensions?.length ?? 0), width: Number(shipping?.dimensions?.width ?? 0), height: Number(shipping?.dimensions?.height ?? 0) }, origin: String(shipping?.origin ?? "Minas Gerais") },
    ...(row.rating != null ? { rating: Number(row.rating) } : {}), ...(row.review_count != null ? { reviewCount: Number(row.review_count) } : {}), ...(row.sold_count != null ? { soldCount: Number(row.sold_count) } : {}), isFeatured: Boolean(row.is_featured), isBestSeller: Boolean(row.is_best_seller), isOffer: Boolean(row.is_offer), isExclusive: Boolean(row.is_exclusive), tags: Array.isArray(row.tags) ? row.tags.map(String) : [], dataSource: (row.data_source ?? "loja-verified") as Product["dataSource"], ...(row.source_url ? { sourceUrl: String(row.source_url) } : {}), ...(row.card_installment ? { cardInstallment: row.card_installment as Product["cardInstallment"] } : {}), ...(row.seller_note ? { sellerNote: String(row.seller_note) } : {}), ...(row.published_at ? { publishedAt: String(row.published_at) } : {}), ...(row.last_stock_entry_at ? { lastStockEntryAt: String(row.last_stock_entry_at) } : {}), ...(row.last_sale_at ? { lastSaleAt: String(row.last_sale_at) } : {}), heroEnabled: row.hero_enabled !== false, heroPriority: Number(row.hero_priority ?? 0),
  };
}
