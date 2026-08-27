import { randomUUID } from "node:crypto";
import type { CatalogState, InventoryMovementRecord } from "./catalog-store";
import type { OrderCustomerSnapshot, SalesOrderRecord } from "./types";
import { commissionForUnit } from "./commission";

export interface CreateOrderInput {
  requestId: string;
  sellerId: string;
  customer: OrderCustomerSnapshot;
  notes: string;
  items: Array<{
    productId: string;
    quantity: number;
    expectedStock: number;
    unitPriceCents: number;
  }>;
}

export class OrderOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderOperationError";
  }
}

export function createSalesOrder(state: CatalogState, input: CreateOrderInput, actorId: string): SalesOrderRecord {
  const existing = state.operations.orders.find((order) => order.request_id === input.requestId);
  if (existing) return existing;
  if (!input.items.length) throw new OrderOperationError("Adicione pelo menos um produto ao pedido.");
  if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) {
    throw new OrderOperationError("Há um produto repetido no pedido. Ajuste a quantidade em uma única linha.");
  }

  const seller = state.operations.sellers.find((item) => item.id === input.sellerId && item.active);
  if (!seller) throw new OrderOperationError("Selecione um vendedor ativo.");

  const prepared = input.items.map((item) => {
    const product = state.products.find((candidate) => candidate.id === item.productId && candidate.status !== "archived");
    if (!product) throw new OrderOperationError("Um dos produtos não está mais disponível.");
    if (product.stock !== item.expectedStock) throw new OrderOperationError(`O estoque de “${product.name}” mudou. Atualize a página e confira o pedido.`);
    if (item.quantity > product.stock) throw new OrderOperationError(`Há somente ${product.stock} unidade(s) de “${product.name}” em estoque.`);
    if (item.unitPriceCents <= 0) throw new OrderOperationError(`Informe um valor válido para “${product.name}”.`);
    const lineTotal = item.unitPriceCents * item.quantity;
    const gross = product.price_cents * item.quantity;
    const commissionUnit = commissionForUnit(item.unitPriceCents);
    return {
      product,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotal,
      gross,
      commissionUnit,
    };
  });

  const now = new Date().toISOString();
  const id = randomUUID();
  const number = nextOrderNumber(state, now);
  const order: SalesOrderRecord = {
    id,
    number,
    request_id: input.requestId,
    status: "completed",
    seller_id: seller.id,
    seller_name: seller.name,
    customer: input.customer,
    items: prepared.map(({ product, quantity, unitPriceCents, lineTotal, gross, commissionUnit }) => ({
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      quantity,
      list_unit_price_cents: product.price_cents,
      unit_price_cents: unitPriceCents,
      discount_cents: Math.max(0, gross - lineTotal),
      line_total_cents: lineTotal,
      commission_unit_cents: commissionUnit,
      commission_total_cents: commissionUnit * quantity,
    })),
    total_units: prepared.reduce((sum, item) => sum + item.quantity, 0),
    gross_total_cents: prepared.reduce((sum, item) => sum + item.gross, 0),
    discount_total_cents: prepared.reduce((sum, item) => sum + Math.max(0, item.gross - item.lineTotal), 0),
    total_cents: prepared.reduce((sum, item) => sum + item.lineTotal, 0),
    commission_total_cents: prepared.reduce((sum, item) => sum + item.commissionUnit * item.quantity, 0),
    notes: input.notes,
    created_by: actorId,
    created_at: now,
    cancelled_at: null,
    cancelled_by: null,
  };

  for (const item of prepared) {
    const before = item.product.stock;
    item.product.stock -= item.quantity;
    item.product.updated_at = now;
    item.product.last_sale_at = now;
    const commissionTotal = item.commissionUnit * item.quantity;
    const effectivePercent = item.lineTotal > 0 ? Number(((commissionTotal / item.lineTotal) * 100).toFixed(4)) : 0;
    const movement: InventoryMovementRecord = {
      id: randomUUID(),
      product_id: item.product.id,
      quantity_delta: -item.quantity,
      stock_before: before,
      stock_after: item.product.stock,
      reason: "sale",
      note: `${number} · ${seller.name} · ${input.customer.name}`,
      commission_percent: effectivePercent,
      commission_cents: commissionTotal,
      actor_id: actorId,
      created_at: now,
      batch_id: input.requestId,
    };
    state.inventoryMovements.unshift(movement);
  }

  state.operations.orders.unshift(order);
  state.auditLogs.unshift({
    id: randomUUID(), actor_id: actorId, action: "order.completed", entity_type: "order", entity_id: id,
    before_data: null, after_data: { number, seller: seller.name, customer: input.customer.name, units: order.total_units, totalCents: order.total_cents, commissionCents: order.commission_total_cents }, created_at: now,
  });
  state.auditLogs = state.auditLogs.slice(0, 1_000);
  return order;
}

export function cancelSalesOrder(state: CatalogState, orderId: string, actorId: string): SalesOrderRecord {
  const order = state.operations.orders.find((item) => item.id === orderId);
  if (!order) throw new OrderOperationError("Pedido não encontrado.");
  if (order.status === "cancelled") return order;
  const now = new Date().toISOString();
  for (const item of order.items) {
    const product = state.products.find((candidate) => candidate.id === item.product_id);
    if (!product) throw new OrderOperationError(`O produto “${item.product_name}” não existe mais. O cancelamento precisa de conferência manual.`);
    const before = product.stock;
    product.stock += item.quantity;
    product.updated_at = now;
    product.last_stock_entry_at = now;
    state.inventoryMovements.unshift({
      id: randomUUID(), product_id: product.id, quantity_delta: item.quantity,
      stock_before: before, stock_after: product.stock, reason: "cancellation",
      note: `Cancelamento ${order.number}`, commission_percent: 0, commission_cents: 0,
      actor_id: actorId, created_at: now, batch_id: `cancel-${order.id}`,
    });
  }
  order.status = "cancelled";
  order.cancelled_at = now;
  order.cancelled_by = actorId;
  state.auditLogs.unshift({
    id: randomUUID(), actor_id: actorId, action: "order.cancelled", entity_type: "order", entity_id: order.id,
    before_data: { status: "completed" }, after_data: { status: "cancelled", restoredUnits: order.total_units }, created_at: now,
  });
  state.auditLogs = state.auditLogs.slice(0, 1_000);
  return order;
}

function nextOrderNumber(state: CatalogState, createdAt: string): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(createdAt));
  const compact = date.replaceAll("-", "");
  const sequence = state.operations.orders.filter((order) => localDate(order.created_at) === date).length + 1;
  return `DG-${compact}-${String(sequence).padStart(3, "0")}`;
}

function localDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
