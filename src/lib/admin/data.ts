import "server-only";

import { readCatalogState } from "./catalog-store";
import { defaultStoreSettings } from "./defaults";
import type { AdminCategoryRow, AdminProductRow, StoreSettings } from "./types";

export { defaultStoreSettings } from "./defaults";

export async function getAdminProducts(): Promise<AdminProductRow[]> {
  const state = await readCatalogState();
  const categoryNames = new Map(state.categories.map((category) => [category.id, category.name]));
  return state.products.map((product) => ({ ...product, categories: { name: categoryNames.get(product.category_id) ?? product.category_id } })).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getAdminProduct(id: string): Promise<AdminProductRow | null> {
  return (await getAdminProducts()).find((product) => product.id === id) ?? null;
}

export async function getAdminCategories(): Promise<AdminCategoryRow[]> {
  return [...(await readCatalogState()).categories].sort((a, b) => a.sort_order - b.sort_order);
}

export async function getDashboardData() {
  const products = await getAdminProducts();
  return {
    total: products.length,
    active: products.filter((item) => item.status === "active").length,
    drafts: products.filter((item) => item.status === "draft").length,
    archived: products.filter((item) => item.status === "archived").length,
    outOfStock: products.filter((item) => item.status !== "archived" && item.stock === 0).length,
    lowStock: products.filter((item) => item.status !== "archived" && item.stock > 0 && item.stock <= item.low_stock_threshold).length,
    incomplete: products.filter((item) => !item.name || !item.sku || !item.description || item.price_cents <= 0 || !item.product_images?.length).length,
    recent: products.slice(0, 6),
  };
}

export async function getInventoryMovements(limit = 30) {
  const state = await readCatalogState();
  const products = new Map(state.products.map((product) => [product.id, { name: product.name, sku: product.sku }]));
  return state.inventoryMovements.slice(0, limit).map((movement) => ({ ...movement, products: products.get(movement.product_id) }));
}

export async function getAuditLogs(limit = 100) {
  const state = await readCatalogState();
  const products = new Map(state.products.map((product) => [product.id, product.name]));
  const categories = new Map(state.categories.map((category) => [category.id, category.name]));
  return state.auditLogs.slice(0, limit).map((log) => ({ ...log, entityName: log.entity_type === "product" ? products.get(log.entity_id) ?? log.entity_id : log.entity_type === "category" ? categories.get(log.entity_id) ?? log.entity_id : log.entity_id }));
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const state = await readCatalogState();
  return { ...defaultStoreSettings, ...state.settings };
}
