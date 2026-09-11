import { randomUUID } from "node:crypto";
import type { InventoryMovementRecord, CatalogState } from "./catalog-store";

export interface InventoryCountUpdate {
  productId: string;
  /** Opcao da planilha, quando o produto vende por cor/voltagem. */
  variantId?: string | null;
  expectedStock: number;
  stock: number;
  expectedPriceCents?: number;
  priceCents?: number;
  oldPriceCents?: number | null;
  cardInstallment?: { count: number; value: number } | null;
}

export interface DailySaleUpdate {
  productId: string;
  variantId?: string | null;
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
  assertUniqueRows(updates);
  const changes = updates.map((update) => {
    const product = state.products.find((item) => item.id === update.productId);
    if (!product) throw new InventoryOperationError("Um dos produtos não existe mais. Atualize a página e tente novamente.");
    const opcao = resolverOpcao(product, update.variantId);
    const rotulo = opcao ? `${product.name} (${opcao.label})` : product.name;
    // Com opcao, o saldo e o preco conferidos sao os DELA; o do produto e so
    // a soma/menor valor, recalculado no fim.
    const stockAtual = opcao ? opcao.stock : product.stock;
    const precoAtual = opcao ? opcao.price_cents : product.price_cents;

    if (stockAtual !== update.expectedStock) {
      throw new InventoryOperationError(`A planilha ficou desatualizada para “${rotulo}”. Atualize a página antes de salvar.`);
    }
    if (update.priceCents !== undefined && precoAtual !== update.expectedPriceCents) {
      throw new InventoryOperationError(`O preço de “${rotulo}” foi alterado em outra sessão. Atualize a página antes de salvar.`);
    }
    const nextPrice = update.priceCents ?? precoAtual;
    const nextOldPrice = Object.prototype.hasOwnProperty.call(update, "oldPriceCents") ? update.oldPriceCents ?? null : product.old_price_cents;
    if (nextOldPrice !== null && nextOldPrice <= nextPrice) {
      throw new InventoryOperationError(`O preço anterior de “${rotulo}” precisa ser maior que o preço atual.`);
    }
    if (stockAtual === update.stock && precoAtual === nextPrice && product.old_price_cents === nextOldPrice && update.cardInstallment === undefined) return null;
    return { product, opcao, update, nextPrice, nextOldPrice, stockAtual, precoAtual };
  }).filter((change) => change !== null);

  if (!changes.length) return 0;
  const now = new Date().toISOString();
  for (const { product, opcao, update, nextPrice, nextOldPrice, stockAtual, precoAtual } of changes) {
    const beforeOldPrice = product.old_price_cents;

    if (opcao) {
      opcao.stock = update.stock;
      opcao.price_cents = nextPrice;
      recalcularProduto(product);
    } else {
      product.stock = update.stock;
      product.price_cents = nextPrice;
    }
    // Preco anterior e parcelamento sao do produto, nao da opcao.
    product.old_price_cents = nextOldPrice;
    if (update.cardInstallment !== undefined) product.card_installment = update.cardInstallment;
    product.updated_at = now;

    if (update.stock !== stockAtual) {
      if (update.stock > stockAtual) product.last_stock_entry_at = now;
      state.inventoryMovements.unshift({
        id: randomUUID(), product_id: product.id, variant_id: opcao?.id ?? null,
        quantity_delta: update.stock - stockAtual,
        stock_before: stockAtual, stock_after: update.stock, reason: "correction",
        note: opcao ? `Contagem pela planilha · ${opcao.label}` : "Contagem atualizada pela planilha de estoque",
        commission_percent: 0, commission_cents: 0, actor_id: actorId, created_at: now,
      });
    }
    appendAudit(state, actorId, "inventory.sheet_updated", "product", product.id,
      { stock: stockAtual, priceCents: precoAtual, oldPriceCents: beforeOldPrice, variant: opcao?.label ?? null },
      { stock: update.stock, priceCents: nextPrice, oldPriceCents: nextOldPrice, variant: opcao?.label ?? null });
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
  assertUniqueRows(updates);
  const operations = updates.map((update) => {
    const product = state.products.find((item) => item.id === update.productId);
    if (!product) throw new InventoryOperationError("Um dos produtos não existe mais. Atualize a página e tente novamente.");
    const opcao = resolverOpcao(product, update.variantId);
    const rotulo = opcao ? `${product.name} (${opcao.label})` : product.name;
    const disponivel = opcao ? opcao.stock : product.stock;
    if (disponivel !== update.expectedStock) {
      throw new InventoryOperationError(`A planilha ficou desatualizada para “${rotulo}”. Atualize a página antes de registrar as saídas.`);
    }
    if (update.quantity > disponivel) {
      throw new InventoryOperationError(`A saída de “${rotulo}” é maior que o estoque disponível (${disponivel}).`);
    }
    return { product, opcao, update };
  });

  const now = new Date().toISOString();
  const note = `Baixas avulsas de estoque · ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date())}`;
  let units = 0;
  for (const { product, opcao, update } of operations) {
    const before = opcao ? opcao.stock : product.stock;
    const after = before - update.quantity;
    if (opcao) {
      opcao.stock = after;
      recalcularProduto(product);
    } else {
      product.stock = after;
    }
    product.updated_at = now;
    units += update.quantity;
    const movement: InventoryMovementRecord = {
      id: randomUUID(), product_id: product.id, variant_id: opcao?.id ?? null, quantity_delta: -update.quantity,
      stock_before: before, stock_after: after, reason: "manual_adjustment",
      note: opcao ? `${note} · ${opcao.label}` : note,
      commission_percent: 0, commission_cents: 0, actor_id: actorId, created_at: now, batch_id: batchId,
    };
    state.inventoryMovements.unshift(movement);
  }
  appendAudit(state, actorId, "inventory.daily_sales", "inventory", batchId, null, { products: operations.length, units, note });
  return { products: operations.length, units, alreadyApplied: false };
}

type Produto = CatalogState["products"][number];
type Opcao = NonNullable<Produto["product_variants"]>[number];

/**
 * Localiza a opcao que a linha da planilha representa.
 *
 * Produto com variacao SEM opcao informada e recusado: o saldo dele e apenas
 * a soma das opcoes, recalculada pelo banco, e uma contagem gravada ali seria
 * apagada na sincronizacao seguinte — a correcao sumiria sem aviso.
 */
function resolverOpcao(product: Produto, variantId?: string | null): Opcao | undefined {
  const ativas = (product.product_variants ?? []).filter((linha) => linha.active);
  if (!variantId) {
    if (ativas.length) throw new InventoryOperationError(`“${product.name}” tem variações. Ajuste o estoque de cada opção na linha dela.`);
    return undefined;
  }
  const opcao = ativas.find((linha) => linha.id === variantId);
  if (!opcao) throw new InventoryOperationError(`A opção de “${product.name}” não existe mais. Atualize a página e tente novamente.`);
  return opcao;
}

/**
 * Mesma conta que sync_product_stock faz no banco. Manter aqui evita a
 * planilha e a lista mostrarem o total velho ate a proxima leitura.
 */
function recalcularProduto(product: Produto) {
  const ativas = (product.product_variants ?? []).filter((linha) => linha.active);
  product.stock = ativas.reduce((soma, linha) => soma + linha.stock, 0);
  if (ativas.length) product.price_cents = Math.min(...ativas.map((linha) => linha.price_cents));
}

/** A identidade da linha e produto MAIS opcao: duas cores nao sao repeticao. */
function assertUniqueRows(updates: Array<{ productId: string; variantId?: string | null }>) {
  const chaves = updates.map((update) => `${update.productId}::${update.variantId ?? ""}`);
  if (new Set(chaves).size !== chaves.length) throw new InventoryOperationError("Há uma linha repetida nesta operação. Revise a planilha e tente novamente.");
}

// Sem corte: `replace_catalog_state` grava com "on conflict do nothing" e nao
// apaga mais o que ja esta no banco. Truncar aqui so descartaria registro novo.
function appendAudit(state: CatalogState, actorId: string, action: string, entityType: string, entityId: string, beforeData: unknown, afterData: unknown) {
  state.auditLogs.unshift({ id: randomUUID(), actor_id: actorId, action, entity_type: entityType, entity_id: entityId, before_data: beforeData, after_data: afterData, created_at: new Date().toISOString() });
}
