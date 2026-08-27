import { randomUUID } from "node:crypto";
import type { InventoryMovementRecord, CatalogState } from "./catalog-store";

export interface InventoryCountUpdate {
  productId: string;
  expectedStock: number;
  stock: number;
  expectedPriceCents?: number;
  priceCents?: number;
  oldPriceCents?: number | null;
  cardInstallment?: { count: number; value: number } | null;
}

export interface DailySaleUpdate {
  productId: string;
  expectedStock: number;
  quantity: number;
}

export class InventoryOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryOperationError";
  }
}

export function applyInventoryCounts(
  state: CatalogState,
  updates: InventoryCountUpdate[],
  actorId: string,
): number {
  assertUniqueProductIds(updates.map((update) => update.productId));
  const changes = updates.map((update) => {
    const product = state.products.find((item) => item.id === update.productId);
    if (!product) throw new InventoryOperationError("Um dos produtos não existe mais. Atualize a página e tente novamente.");
    if (product.stock !== update.expectedStock) {
      throw new InventoryOperationError(`A planilha ficou desatualizada para “${product.name}”. Atualize a página antes de salvar.`);
    }
    if (update.priceCents !== undefined && product.price_cents !== update.expectedPriceCents) {
      throw new InventoryOperationError(`O preço de “${product.name}” foi alterado em outra sessão. Atualize a página antes de salvar.`);
    }
    const nextPrice = update.priceCents ?? product.price_cents;
    const nextOldPrice = Object.prototype.hasOwnProperty.call(update, "oldPriceCents") ? update.oldPriceCents ?? null : product.old_price_cents;
    if (nextOldPrice !== null && nextOldPrice <= nextPrice) {
      throw new InventoryOperationError(`O preço anterior de “${product.name}” precisa ser maior que o preço atual.`);
    }
    if (product.stock === update.stock && product.price_cents === nextPrice && product.old_price_cents === nextOldPrice && update.cardInstallment === undefined) return null;
    return { product, update, nextPrice, nextOldPrice };
  }).filter((change): change is { product: CatalogState["products"][number]; update: InventoryCountUpdate; nextPrice: number; nextOldPrice: number | null } => change !== null);

  if (!changes.length) return 0;
  const now = new Date().toISOString();
  for (const { product, update, nextPrice, nextOldPrice } of changes) {
    const before = product.stock;
    const beforePrice = product.price_cents;
    const beforeOldPrice = product.old_price_cents;
    product.stock = update.stock;
    product.price_cents = nextPrice;
    product.old_price_cents = nextOldPrice;
    if (update.cardInstallment !== undefined) product.card_installment = update.cardInstallment;
    product.updated_at = now;
    if (update.stock !== before) {
      if (update.stock > before) product.last_stock_entry_at = now;
      state.inventoryMovements.unshift({
        id: randomUUID(), product_id: product.id, quantity_delta: update.stock - before,
        stock_before: before, stock_after: update.stock, reason: "correction",
        note: "Contagem atualizada pela planilha de estoque", commission_percent: 0, commission_cents: 0,
        actor_id: actorId, created_at: now,
      });
    }
    appendAudit(state, actorId, "inventory.sheet_updated", "product", product.id, { stock: before, priceCents: beforePrice, oldPriceCents: beforeOldPrice }, { stock: update.stock, priceCents: nextPrice, oldPriceCents: nextOldPrice });
  }
  return changes.length;
}

export function applyDailySales(
  state: CatalogState,
  updates: DailySaleUpdate[],
  actorId: string,
  batchId: string,
): { products: number; units: number; alreadyApplied: boolean } {
  if (state.inventoryMovements.some((movement) => movement.batch_id === batchId)) {
    return { products: 0, units: 0, alreadyApplied: true };
  }
  assertUniqueProductIds(updates.map((update) => update.productId));
  const operations = updates.map((update) => {
    const product = state.products.find((item) => item.id === update.productId);
    if (!product) throw new InventoryOperationError("Um dos produtos não existe mais. Atualize a página e tente novamente.");
    if (product.stock !== update.expectedStock) {
      throw new InventoryOperationError(`A planilha ficou desatualizada para “${product.name}”. Atualize a página antes de registrar as saídas.`);
    }
    if (update.quantity > product.stock) {
      throw new InventoryOperationError(`A saída de “${product.name}” é maior que o estoque disponível (${product.stock}).`);
    }
    return { product, update };
  });

  const now = new Date().toISOString();
  const note = `Baixas avulsas de estoque · ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date())}`;
  let units = 0;
  for (const { product, update } of operations) {
    const before = product.stock;
    const after = before - update.quantity;
    product.stock = after;
    product.updated_at = now;
    units += update.quantity;
    const movement: InventoryMovementRecord = {
      id: randomUUID(), product_id: product.id, quantity_delta: -update.quantity,
      stock_before: before, stock_after: after, reason: "manual_adjustment", note,
      commission_percent: 0, commission_cents: 0, actor_id: actorId, created_at: now, batch_id: batchId,
    };
    state.inventoryMovements.unshift(movement);
  }
  appendAudit(state, actorId, "inventory.daily_sales", "inventory", batchId, null, { products: operations.length, units, note });
  return { products: operations.length, units, alreadyApplied: false };
}

function assertUniqueProductIds(ids: string[]) {
  if (new Set(ids).size !== ids.length) throw new InventoryOperationError("Há um produto repetido nesta operação. Revise a planilha e tente novamente.");
}

function appendAudit(state: CatalogState, actorId: string, action: string, entityType: string, entityId: string, beforeData: unknown, afterData: unknown) {
  state.auditLogs.unshift({ id: randomUUID(), actor_id: actorId, action, entity_type: entityType, entity_id: entityId, before_data: beforeData, after_data: afterData, created_at: new Date().toISOString() });
  state.auditLogs = state.auditLogs.slice(0, 1000);
}
