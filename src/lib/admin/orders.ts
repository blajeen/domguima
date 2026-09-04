import { randomUUID } from "node:crypto";
import {
  createOrderRecord,
  updateOrderRecord,
  LedgerStockError,
  type CatalogState,
  type LedgerAuditDraft,
  type LedgerMovementDraft,
  type OrderDraft,
} from "./catalog-store";
import type { OrderCustomerSnapshot, OrderDeliveryMethod, OrderPaymentMethod, SalesOrderRecord } from "./types";
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

export interface CreatePendingOrderInput {
  requestId: string;
  customer: OrderCustomerSnapshot;
  notes: string;
  paymentMethod: OrderPaymentMethod;
  deliveryMethod: OrderDeliveryMethod;
  items: Array<{
    productId: string;
    quantity: number;
    variant?: string | null;
  }>;
}

export class OrderOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderOperationError";
  }
}

/**
 * O `state` aqui serve apenas para validar e montar o pedido (nomes, precos,
 * vendedor). A gravacao — pedido, baixa de estoque, movimento e auditoria —
 * acontece no banco, numa transacao so. O estoque conferido aqui e uma
 * cortesia para dar mensagem boa ao operador; quem realmente impede venda
 * acima do saldo e a trava dentro da transacao.
 */
export async function createSalesOrder(state: CatalogState, input: CreateOrderInput, actorId: string): Promise<SalesOrderRecord> {
  // Reenvio do mesmo pedido devolve o que ja existe. A checagem repete no
  // banco (unique em request_id); aqui ela evita reprovar o retry por causa do
  // estoque que a primeira tentativa ja baixou.
  const jaCriado = state.operations.orders.find((order) => order.request_id === input.requestId);
  if (jaCriado) return jaCriado;
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
  const draft: OrderDraft = {
    id: randomUUID(),
    request_id: input.requestId,
    status: "completed",
    seller_id: seller.id,
    seller_name: seller.name,
    payment_method: "to_confirm",
    delivery_method: "shipping_to_confirm",
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

  // `{{number}}` porque o numero do pedido so nasce dentro da transacao.
  const movements: LedgerMovementDraft[] = prepared.map((item) => {
    const commissionTotal = item.commissionUnit * item.quantity;
    return {
      product_id: item.product.id,
      quantity_delta: -item.quantity,
      reason: "sale",
      note: `{{number}} · ${seller.name} · ${input.customer.name}`,
      commission_percent: item.lineTotal > 0 ? Number(((commissionTotal / item.lineTotal) * 100).toFixed(4)) : 0,
      commission_cents: commissionTotal,
      actor_id: actorId,
      batch_id: input.requestId,
    };
  });

  const audit: LedgerAuditDraft = {
    actor_id: actorId,
    action: "order.completed",
    entity_type: "order",
    entity_id: draft.id,
    before_data: null,
    after_data: { seller: seller.name, customer: input.customer.name, units: draft.total_units, totalCents: draft.total_cents, commissionCents: draft.commission_total_cents },
  };

  const { order } = await gravarPedido(() => createOrderRecord(draft, movements, audit), prepared.map((item) => item.product));
  return order;
}

/**
 * Cria uma solicitacao vinda do checkout publico sem baixar o estoque.
 * O cliente ainda precisa confirmar disponibilidade, frete e pagamento com a loja.
 */
export async function createPendingSalesOrder(state: CatalogState, input: CreatePendingOrderInput): Promise<SalesOrderRecord> {
  // Reenvio do mesmo pedido devolve o que ja existe. A checagem repete no
  // banco (unique em request_id); aqui ela evita reprovar o retry por causa do
  // estoque que a primeira tentativa ja baixou.
  const jaCriado = state.operations.orders.find((order) => order.request_id === input.requestId);
  if (jaCriado) return jaCriado;
  if (!input.items.length) throw new OrderOperationError("Adicione pelo menos um produto ao pedido.");
  if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) {
    throw new OrderOperationError("Ha um produto repetido no pedido. Ajuste a quantidade em uma unica linha.");
  }

  const prepared = input.items.map((item) => {
    const product = state.products.find((candidate) => candidate.id === item.productId && candidate.status === "active");
    if (!product) throw new OrderOperationError("Um dos produtos nao esta mais disponivel.");
    if (item.quantity > product.stock) throw new OrderOperationError(`Ha somente ${product.stock} unidade(s) de “${product.name}”.`);
    if (product.price_cents <= 0) throw new OrderOperationError(`O produto “${product.name}” esta sem preco valido.`);
    const lineTotal = product.price_cents * item.quantity;
    const commissionUnit = commissionForUnit(product.price_cents);
    return { product, quantity: item.quantity, variant: item.variant ?? null, lineTotal, gross: lineTotal, commissionUnit };
  });

  const now = new Date().toISOString();
  const draft: OrderDraft = {
    id: randomUUID(),
    request_id: input.requestId,
    status: "pending",
    seller_id: "pending",
    seller_name: "Aguardando definicao",
    payment_method: input.paymentMethod,
    delivery_method: input.deliveryMethod,
    customer: input.customer,
    items: prepared.map(({ product, quantity, variant, lineTotal, commissionUnit }) => ({
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      variant,
      quantity,
      list_unit_price_cents: product.price_cents,
      unit_price_cents: product.price_cents,
      discount_cents: 0,
      line_total_cents: lineTotal,
      commission_unit_cents: commissionUnit,
      commission_total_cents: commissionUnit * quantity,
    })),
    total_units: prepared.reduce((sum, item) => sum + item.quantity, 0),
    gross_total_cents: prepared.reduce((sum, item) => sum + item.gross, 0),
    discount_total_cents: 0,
    total_cents: prepared.reduce((sum, item) => sum + item.lineTotal, 0),
    commission_total_cents: prepared.reduce((sum, item) => sum + item.commissionUnit * item.quantity, 0),
    notes: input.notes,
    created_by: "public-site",
    created_at: now,
    cancelled_at: null,
    cancelled_by: null,
  };

  const audit: LedgerAuditDraft = {
    actor_id: "public-site",
    action: "order.received",
    entity_type: "order",
    entity_id: draft.id,
    before_data: null,
    after_data: { customer: input.customer.name, units: draft.total_units, totalCents: draft.total_cents, source: "site" },
  };

  // Sem movimentos: a solicitacao ainda nao reserva estoque.
  const { order } = await gravarPedido(() => createOrderRecord(draft, [], audit), []);
  return order;
}

/** Confirma uma solicitacao recebida no site e somente entao baixa o estoque. */
export async function confirmPendingSalesOrder(state: CatalogState, orderId: string, sellerId: string, actorId: string): Promise<SalesOrderRecord> {
  const order = state.operations.orders.find((item) => item.id === orderId);
  if (!order) throw new OrderOperationError("Pedido nao encontrado.");
  if (order.status === "completed") return order;
  if (order.status === "cancelled") throw new OrderOperationError("Este pedido ja foi cancelado.");

  const seller = state.operations.sellers.find((item) => item.id === sellerId && item.active);
  if (!seller) throw new OrderOperationError("Selecione um vendedor ativo.");

  const produtos = order.items.map((item) => {
    const product = state.products.find((candidate) => candidate.id === item.product_id && candidate.status !== "archived");
    if (!product) throw new OrderOperationError(`O produto “${item.product_name}” nao esta mais disponivel.`);
    if (item.quantity > product.stock) throw new OrderOperationError(`Ha somente ${product.stock} unidade(s) de “${product.name}” no estoque.`);
    return product;
  });

  const movements: LedgerMovementDraft[] = order.items.map((item) => {
    const commissionTotal = item.commission_unit_cents * item.quantity;
    return {
      product_id: item.product_id,
      quantity_delta: -item.quantity,
      reason: "sale",
      note: `${order.number} · ${seller.name} · ${order.customer.name}`,
      commission_percent: item.line_total_cents > 0 ? Number(((commissionTotal / item.line_total_cents) * 100).toFixed(4)) : 0,
      commission_cents: commissionTotal,
      actor_id: actorId,
      batch_id: `confirm-${order.id}`,
    };
  });

  const audit: LedgerAuditDraft = {
    actor_id: actorId,
    action: "order.confirmed",
    entity_type: "order",
    entity_id: order.id,
    before_data: { status: "pending" },
    after_data: { status: "completed", seller: seller.name, units: order.total_units, totalCents: order.total_cents },
  };

  // `expectedStatus: "pending"` e o que impede a confirmacao dupla de baixar o
  // estoque duas vezes quando dois cliques chegam juntos.
  const resultado = await gravarAtualizacao(
    () => updateOrderRecord(order.id, "pending", { status: "completed", seller_id: seller.id, seller_name: seller.name }, movements, audit),
    produtos,
  );
  if (!resultado.found) throw new OrderOperationError("Pedido nao encontrado.");
  if (!resultado.applied) {
    if (resultado.order?.status === "completed") return resultado.order;
    throw new OrderOperationError("Este pedido ja foi cancelado.");
  }
  return resultado.order!;
}

export async function cancelSalesOrder(state: CatalogState, orderId: string, actorId: string): Promise<SalesOrderRecord> {
  const order = state.operations.orders.find((item) => item.id === orderId);
  if (!order) throw new OrderOperationError("Pedido não encontrado.");
  if (order.status === "cancelled") return order;

  const now = new Date().toISOString();
  const statusAnterior = order.status;
  const patch = { status: "cancelled" as const, cancelled_at: now, cancelled_by: actorId };
  const audit: LedgerAuditDraft = {
    actor_id: actorId,
    action: "order.cancelled",
    entity_type: "order",
    entity_id: order.id,
    before_data: { status: statusAnterior },
    after_data: { status: "cancelled", restoredUnits: statusAnterior === "completed" ? order.total_units : 0 },
  };

  // Pedido pendente nunca baixou estoque, entao nao ha o que devolver.
  const produtos = statusAnterior === "completed"
    ? order.items.map((item) => {
        const product = state.products.find((candidate) => candidate.id === item.product_id);
        if (!product) throw new OrderOperationError(`O produto “${item.product_name}” não existe mais. O cancelamento precisa de conferência manual.`);
        return product;
      })
    : [];

  const movements: LedgerMovementDraft[] = statusAnterior === "completed"
    ? order.items.map((item) => ({
        product_id: item.product_id,
        quantity_delta: item.quantity,
        reason: "cancellation",
        note: `Cancelamento ${order.number}`,
        actor_id: actorId,
        batch_id: `cancel-${order.id}`,
      }))
    : [];

  const resultado = await gravarAtualizacao(
    () => updateOrderRecord(order.id, statusAnterior, patch, movements, audit),
    produtos,
  );
  if (!resultado.found) throw new OrderOperationError("Pedido não encontrado.");
  // Não aplicado significa que o status mudou entre a leitura e a gravação —
  // outra sessão já cancelou, ou confirmou no intervalo.
  if (!resultado.applied) {
    if (resultado.order?.status === "cancelled") return resultado.order;
    throw new OrderOperationError("O pedido mudou de situação em outra sessão. Atualize a página e tente novamente.");
  }
  return resultado.order!;
}

/**
 * Traduz o erro cru da transacao para uma mensagem com o nome do produto. O
 * banco so conhece o id; quem tem o nome e a lista que acabamos de validar.
 */
async function gravarPedido(
  operacao: () => Promise<{ order: SalesOrderRecord; alreadyExisted: boolean }>,
  produtos: Array<{ id: string; name: string }>,
): Promise<{ order: SalesOrderRecord; alreadyExisted: boolean }> {
  try {
    return await operacao();
  } catch (error) {
    throw traduzir(error, produtos);
  }
}

async function gravarAtualizacao(
  operacao: () => Promise<{ order: SalesOrderRecord | null; found: boolean; applied: boolean }>,
  produtos: Array<{ id: string; name: string }>,
) {
  try {
    return await operacao();
  } catch (error) {
    throw traduzir(error, produtos);
  }
}

function traduzir(error: unknown, produtos: Array<{ id: string; name: string }>): unknown {
  if (!(error instanceof LedgerStockError)) return error;
  const nome = produtos.find((product) => product.id === error.productId)?.name ?? "um dos produtos";
  return error.kind === "insufficient"
    ? new OrderOperationError(`O estoque de “${nome}” acabou de mudar. Atualize a página e confira o pedido.`)
    : new OrderOperationError(`O produto “${nome}” não está mais disponível.`);
}
