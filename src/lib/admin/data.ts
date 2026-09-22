import "server-only";

import { readCatalogState } from "./catalog-store";
import { defaultStoreSettings } from "./defaults";
import { countLeads, leadLocalDate } from "./leads";
import { canonicalSellerId, sortSellers } from "./sellers";
import type { AdminCategoryRow, AdminProductRow, ProductAssistTemplate, ProductOperationalMeta, StoreSettings } from "./types";

export { defaultStoreSettings } from "./defaults";

export async function getAdminProducts(): Promise<AdminProductRow[]> {
  const state = await readCatalogState();
  const categoryNames = new Map(state.categories.map((category) => [category.id, category.name]));
  return state.products.map((product) => ({ ...product, categories: { name: categoryNames.get(product.category_id) ?? product.category_id } })).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getAdminProduct(id: string): Promise<AdminProductRow | null> {
  return (await getAdminProducts()).find((product) => product.id === id) ?? null;
}

export async function getProductOperationalMeta(id: string) {
  return normalizeProductOperationalMeta((await readCatalogState()).operations.product_meta[id]);
}

/**
 * Mapa de NCM, modelo e GTIN por produto.
 *
 * A lista do painel precisa disso para achar produto por NCM — o codigo fiscal
 * nao fica na tabela de produtos, e sim nas anotacoes operacionais.
 */
export async function getAllProductOperationalMeta(): Promise<Map<string, ProductOperationalMeta>> {
  const meta = (await readCatalogState()).operations.product_meta ?? {};
  return new Map(Object.entries(meta).map(([id, value]) => [id, normalizeProductOperationalMeta(value)]));
}

export async function getProductAssistTemplates(excludeId?: string): Promise<ProductAssistTemplate[]> {
  const state = await readCatalogState();
  const categoryNames = new Map(state.categories.map((category) => [category.id, category.name]));
  return state.products
    .filter((product) => product.id !== excludeId && product.status !== "archived")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      brand: product.brand ?? "",
      category_id: product.category_id,
      category_name: categoryNames.get(product.category_id) ?? product.category_id,
      description: product.description,
      tags: product.tags,
      specifications: product.specifications,
      variants: product.variants,
      shipping: product.shipping,
      seller_note: product.seller_note ?? "",
    }));
}

export async function getSellers() {
  return [...(await readCatalogState()).operations.sellers].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/**
 * Quantos pedidos cada atendente ja tem (por id canonico: pedidos antigos
 * gravados como "dom-guima" contam para "juliano"). Quem tem pedido nao pode
 * ser removido da lista, so desativado — senao o relatorio ficaria orfao.
 */
export async function getSellerOrderCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const order of (await readCatalogState()).operations.orders) {
    const id = canonicalSellerId(order.seller_id);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export async function getSalesOrders() {
  return [...(await readCatalogState()).operations.orders].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getAdminCategories(): Promise<AdminCategoryRow[]> {
  return [...(await readCatalogState()).categories].sort((a, b) => a.sort_order - b.sort_order);
}

export async function getDashboardData() {
  const products = await getAdminProducts();
  const state = await readCatalogState();
  const pendingOrders = state.operations.orders.filter((order) => order.status === "pending").length;

  // Atendimentos moram fora do catalogo: contagens exatas no banco (ou no
  // arquivo local), com "hoje" no fuso da loja. Sem a tabela ainda criada,
  // cada contagem avisa no console e vale 0 — o painel abre do mesmo jeito.
  const hoje = leadLocalDate(new Date().toISOString());
  const atendentes = sortSellers(state.operations.sellers.filter((seller) => seller.active));
  const [freeLeads, leadsToday, leadsTodayUnassigned, ...hojePorAtendente] = await Promise.all([
    countLeads({ unassigned: true, open: true }),
    countLeads({ from: hoje, to: hoje }),
    countLeads({ from: hoje, to: hoje, unassigned: true }),
    ...atendentes.map((seller) => countLeads({ from: hoje, to: hoje, sellerId: seller.id })),
  ]);

  return {
    /** Hoje (YYYY-MM-DD, fuso da loja): o link do card leva à lista filtrada no mesmo dia que ele contou. */
    today: hoje,
    freeLeads,
    leadsToday,
    /** Chegaram hoje e ainda estão sem atendente. */
    leadsTodayUnassigned,
    /** Atendimentos de hoje por atendente ativo, na ordem do painel. */
    leadsBySeller: atendentes.map((seller, indice) => ({ sellerId: seller.id, name: seller.name, count: hojePorAtendente[indice] ?? 0 })),
    total: products.length,
    active: products.filter((item) => item.status === "active").length,
    drafts: products.filter((item) => item.status === "draft").length,
    archived: products.filter((item) => item.status === "archived").length,
    outOfStock: products.filter((item) => item.status !== "archived" && item.stock === 0).length,
    lowStock: products.filter((item) => item.status !== "archived" && item.stock > 0 && item.stock <= item.low_stock_threshold).length,
    incomplete: products.filter((item) => !item.name || !item.sku || !item.description || item.price_cents <= 0 || !item.product_images?.length).length,
    pendingOrders,
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
  const orders = new Map(state.operations.orders.map((order) => [order.id, order.number]));
  // Atendimentos moram em tabela propria e nao estao no estado do catalogo:
  // em vez de despejar um uuid cru na coluna "Item", mostramos um rotulo curto
  // — o nome do cliente ja viaja em after_data e aparece nos detalhes.
  return state.auditLogs.slice(0, limit).map((log) => ({ ...log, entityName: log.entity_type === "product" ? products.get(log.entity_id) ?? log.entity_id : log.entity_type === "category" ? categories.get(log.entity_id) ?? log.entity_id : log.entity_type === "order" ? orders.get(log.entity_id) ?? log.entity_id : log.entity_type === "lead" ? `Atendimento ${log.entity_id.slice(0, 8)}` : log.entity_id }));
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const state = await readCatalogState();
  return { ...defaultStoreSettings, ...state.settings };
}

function normalizeProductOperationalMeta(value?: Partial<ProductOperationalMeta> | null): ProductOperationalMeta {
  return {
    ncm: typeof value?.ncm === "string" ? value.ncm : "",
    cost_cents: typeof value?.cost_cents === "number" ? value.cost_cents : null,
    model: typeof value?.model === "string" ? value.model : "",
    gtin: typeof value?.gtin === "string" ? value.gtin : "",
  };
}
