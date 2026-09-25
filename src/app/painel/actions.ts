"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { contaPrincipalOrThrow, createAdminSession, destroyAdminSession, ownerOrThrow, verifyAdminCredentials } from "@/lib/admin/auth";
import { CONDICOES_LOJISTA_MAXIMO, DESCONTO_LOJISTA_MAXIMO, formatarDesconto, lerDescontoDigitado, linhasParaLojistas, validarPrecoEspecial } from "@/lib/admin/lojistas";
import { formatPrice } from "@/lib/utils/format";
import { copyCatalogImage, countProductMovements, createImageUploadTarget, createInitialState, deleteCatalogImage, deleteOrderRecords, imageExistsInStorage, mutateCatalogState, readCatalogState, type CatalogState } from "@/lib/admin/catalog-store";
import { buildCustomerIndex, customerKey, phoneKey } from "@/lib/admin/customers";
import { getCustomerPurchases } from "@/lib/admin/data";
import { applyDailySales, applyInventoryCounts, InventoryOperationError } from "@/lib/admin/inventory";
import { assignLeadOfOrder, assignOrderOfLead, checkLeadStageChange, closeLeadsOfOrders, discardLeadsOfDeletedOrders, findOrderByNumber, linkLeadToOrder, orderLockForLead } from "@/lib/admin/lead-orders";
import { createLead, findLead, LEAD_CRM_UNAVAILABLE_MESSAGE, updateLead } from "@/lib/admin/leads";
import { assignPendingSalesOrder, cancelSalesOrder, confirmPendingSalesOrder, createChannelSalesOrder, createSalesOrder, OrderOperationError } from "@/lib/admin/orders";
import { canonicalSellerId, normalizeLeadDistributionMode, normalizeSeller, RESERVED_SELLER_IDS, SELLER_ID_PATTERN, sellerIdFromName, UNLINKED_LOGIN_HINT } from "@/lib/admin/sellers";
import { buildCategorySkuChoices } from "@/lib/admin/sku";
import { BULK_CHANNELS } from "@/lib/admin/bulk-orders";
import {
  LEAD_LOST_REASON_LABELS,
  LEAD_LOST_REASONS,
  LEAD_STAGE_LABELS,
  LEAD_STAGES,
  PANEL_ORDER_CHANNELS,
  PANEL_TRAFFIC_SOURCES,
  type ActionState,
  type AdminProductRow,
  type AdminProductVariant,
  type CustomerPurchaseLookup,
  type SellerRecord,
  type StoreSettings,
  type TrafficSource,
} from "@/lib/admin/types";
import { isTrafficSource, trafficSourceLabel } from "@/lib/services/origem";
import { ANUNCIAR_ATE_PADRAO, MAX_PARCELAS, taxasParaTexto, validarTabelaDigitada } from "@/lib/catalog/parcelamento";
import { categorySchema, moneyToCents, numberFrom, productSchema } from "@/lib/admin/validation";
import { isValidCPF, isValidDocument, isValidGTIN, onlyDigits } from "@/lib/utils/validators";

const inventoryCountInput = z.object({
  productId: z.string().trim().min(1).max(200),
  variantId: z.string().trim().max(120).nullable().optional(),
  expectedStock: z.number().int().min(0),
  stock: z.number().int().min(0).max(1_000_000),
  expectedPriceCents: z.number().int().positive().optional(),
  priceCents: z.number().int().positive().optional(),
  oldPriceCents: z.number().int().positive().nullable().optional(),
});

const dailySaleInput = z.object({
  productId: z.string().trim().min(1).max(200),
  variantId: z.string().trim().max(120).nullable().optional(),
  expectedStock: z.number().int().min(0),
  quantity: z.number().int().min(1).max(1_000_000),
});

const orderInput = z.object({
  requestId: z.string().regex(/^[a-zA-Z0-9_-]{8,120}$/),
  sellerId: z.string().trim().min(1).max(80),
  customer: z.object({
    name: z.string().trim().min(3).max(140),
    cpf: z.string().transform(onlyDigits).refine(isValidCPF, "CPF inválido."),
    phone: z.string().trim().max(30),
    cep: z.string().transform(onlyDigits).refine((value) => value.length === 8, "CEP inválido."),
    street: z.string().trim().min(2).max(180),
    number: z.string().trim().min(1).max(30),
    complement: z.string().trim().max(100),
    neighborhood: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  }),
  notes: z.string().trim().max(500),
  channel: z.enum(PANEL_ORDER_CHANNELS, { error: "Escolha onde a venda foi fechada." }),
  // Qualquer origem conhecida passa aqui; a action restringe às do painel, mais
  // a do atendimento de origem (um cliente que veio da Shopee continua Shopee).
  source: z.custom<TrafficSource>(isTrafficSource, { error: "Escolha como o cliente chegou até a loja." }),
  // Atendimento de onde o pedido saiu ("Lançar pedido" na tela de Atendimento).
  leadId: z.string().trim().max(80).nullable().optional(),
  items: z.array(z.object({
    productId: z.string().trim().min(1).max(200),
    variantId: z.string().trim().max(120).nullable().optional(),
    quantity: z.number().int().min(1).max(10_000),
    expectedStock: z.number().int().min(0),
    unitPriceCents: z.number().int().positive().max(100_000_000),
  })).min(1).max(100),
});

/**
 * Freio de força bruta no login. O scrypt já torna cada tentativa cara, mas
 * sem limite um atacante pode tentar indefinidamente. Após MAX_LOGIN_ATTEMPTS
 * falhas seguidas, bloqueia por LOGIN_BLOCK_MS.
 *
 * Limite conhecido: o contador vive na memória da instância. Em serverless com
 * várias instâncias o teto efetivo é maior. Para um freio realmente global,
 * usar um store compartilhado (Vercel KV/Upstash).
 */
const loginAttempts = new Map<string, { count: number; windowStart: number; blockedUntil: number }>();
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1_000;
const LOGIN_BLOCK_MS = 15 * 60 * 1_000;

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const key = username.toLowerCase() || "(vazio)";
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (record && record.blockedUntil > now) {
    const minutos = Math.ceil((record.blockedUntil - now) / 60_000);
    return { message: `Muitas tentativas. Tente novamente em ${minutos} minuto(s).` };
  }

  const conta = await verifyAdminCredentials(username, password);
  if (!conta) {
    // O contador só zera quando a JANELA expira. Usar `blockedUntil` para isso
    // reiniciava a contagem a cada tentativa (0 é sempre <= agora).
    const janelaViva = record && now - record.windowStart < LOGIN_WINDOW_MS;
    const count = (janelaViva ? record.count : 0) + 1;
    loginAttempts.set(key, {
      count,
      windowStart: janelaViva ? record.windowStart : now,
      blockedUntil: count >= MAX_LOGIN_ATTEMPTS ? now + LOGIN_BLOCK_MS : 0,
    });
    return { message: "Usuario ou senha incorretos." };
  }

  loginAttempts.delete(key);
  await createAdminSession(conta);
  redirect("/painel");
}

export async function logoutAction() { await destroyAdminSession(); redirect("/painel/login"); }

export async function saveProductAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const id = String(formData.get("id") || formData.get("slug") || randomUUID()).trim();
  const oldPriceRaw = String(formData.get("oldPrice") ?? "").trim();
  const costRaw = String(formData.get("cost") ?? "").trim();
  const costCents = costRaw ? moneyToCents(costRaw) : null;
  const ncm = onlyDigits(String(formData.get("ncm") ?? ""));
  const model = String(formData.get("model") ?? "").trim();
  const gtin = onlyDigits(String(formData.get("gtin") ?? ""));
  const automaticSku = formData.get("skuMode") === "auto";
  if (costCents !== null && costCents <= 0) return { message: "Informe um custo válido ou deixe o campo vazio." };
  if (ncm && ncm.length !== 8) return { message: "O NCM deve conter exatamente 8 dígitos." };
  if (model.length > 100) return { message: "O modelo deve ter no máximo 100 caracteres." };
  if (gtin && !isValidGTIN(gtin)) return { message: "Informe um EAN/GTIN válido ou deixe o campo vazio." };
  const parsed = productSchema.safeParse({
    id, name: formData.get("name"), slug: formData.get("slug"), sku: formData.get("sku"), brand: formData.get("brand"),
    categoryId: formData.get("categoryId"), description: formData.get("description"), priceCents: moneyToCents(formData.get("price")),
    oldPriceCents: oldPriceRaw ? moneyToCents(oldPriceRaw) : null, stock: Math.trunc(numberFrom(formData.get("stock"))),
    lowStockThreshold: Math.trunc(numberFrom(formData.get("lowStockThreshold"))), status: formData.get("status"),
    tags: splitCommaList(formData.get("tags")), sourceUrl: formData.get("sourceUrl"), sellerNote: formData.get("sellerNote"),
    shippingWeight: Math.trunc(numberFrom(formData.get("shippingWeight"))), shippingLength: numberFrom(formData.get("shippingLength")),
    shippingWidth: numberFrom(formData.get("shippingWidth")), shippingHeight: numberFrom(formData.get("shippingHeight")),
    shippingOrigin: formData.get("shippingOrigin"), isFeatured: formData.get("isFeatured") === "on",
    isBestSeller: formData.get("isBestSeller") === "on", isOffer: formData.get("isOffer") === "on",
    isExclusive: formData.get("isExclusive") === "on",
    heroEnabled: formData.get("heroEnabled") === "on", heroPriority: Math.trunc(numberFrom(formData.get("heroPriority"))),
  });
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);

  let value = parsed.data;
  let created = false;
  try {
    const state = await readCatalogState();
    const before = state.products.find((product) => product.id === id);
    if (!before && automaticSku) {
      const choice = buildCategorySkuChoices(state.categories, state.products).find((item) => item.categoryId === value.categoryId);
      if (!choice) return { message: "Selecione um setor ativo para gerar o código do produto." };
      value = { ...value, sku: choice.nextSku };
    }
    if (state.products.some((product) => product.id !== id && product.slug === value.slug)) return { message: "Ja existe um produto com este endereco (slug)." };
    if (state.products.some((product) => product.id !== id && product.sku === value.sku)) return { message: "Ja existe um produto com este SKU." };
    const now = new Date().toISOString();
    const product: AdminProductRow = {
      id, external_id: before?.external_id ?? null, name: value.name, slug: value.slug, description: value.description,
      price_cents: value.priceCents, old_price_cents: value.oldPriceCents, category_id: value.categoryId,
      brand: value.brand || null, sku: value.sku, stock: before?.stock ?? value.stock,
      low_stock_threshold: value.lowStockThreshold, status: value.status,
      variants: parseVariants(formData.get("variants")), specifications: parseSpecifications(formData.get("specifications")),
      shipping: { weight: value.shippingWeight, dimensions: { length: value.shippingLength, width: value.shippingWidth, height: value.shippingHeight }, origin: value.shippingOrigin },
      rating: before?.rating ?? null, review_count: before?.review_count ?? null, sold_count: before?.sold_count ?? null,
      is_featured: value.isFeatured, is_best_seller: value.isBestSeller, is_offer: value.isOffer, is_exclusive: value.isExclusive, tags: value.tags,
      data_source: before?.data_source ?? "loja-verified", source_url: value.sourceUrl || null,
      card_installment: before?.card_installment ?? null, seller_note: value.sellerNote || null,
      published_at: before?.status !== "active" && value.status === "active" ? now : before?.published_at ?? null,
      last_stock_entry_at: !before && value.stock > 0 ? now : before?.last_stock_entry_at ?? null,
      last_sale_at: before?.last_sale_at ?? null, hero_enabled: value.heroEnabled, hero_priority: value.heroPriority,
      created_at: before?.created_at ?? now, updated_at: now, product_images: before?.product_images ?? [],
      categories: { name: state.categories.find((category) => category.id === value.categoryId)?.name ?? value.categoryId },
    };

    // Variacoes: quando existem, elas mandam no estoque e no preco-base.
    const variacoes = parseVariantRows(formData.get("variantRows"), id);
    const anteriores = new Map((before?.product_variants ?? []).map((item) => [item.id, item]));
    if (variacoes) {
      const ativas = variacoes.rows.filter((linha) => linha.active);
      product.product_variants = variacoes.rows;
      product.variant_axis = variacoes.axis;
      // `stock` do produto e a soma das variacoes ativas — mesma conta que o
      // banco refaz em sync_product_stock. Manter aqui evita a lista do painel
      // mostrar o numero velho ate a proxima leitura.
      product.stock = ativas.reduce((soma, linha) => soma + linha.stock, 0);
      // O preco do produto passa a ser o menor entre as opcoes: e o que a
      // vitrine mostra como "a partir de".
      if (ativas.length) product.price_cents = Math.min(...ativas.map((linha) => linha.price_cents));
      // A lista de rotulos alimenta a vitrine, que ja sabe exibir variants.
      product.variants = [{ name: variacoes.axis, options: ativas.map((linha) => linha.label) }];
    } else {
      product.product_variants = [];
      product.variant_axis = null;
    }

    await mutateCatalogState((draft) => {
      const index = draft.products.findIndex((item) => item.id === id);
      if (index >= 0) draft.products[index] = product; else draft.products.push(product);
      if (!before && !variacoes && value.stock > 0) draft.inventoryMovements.unshift({ id: randomUUID(), product_id: id, quantity_delta: value.stock, stock_before: 0, stock_after: value.stock, reason: "initial_import", note: "Estoque informado no cadastro", commission_percent: 0, commission_cents: 0, actor_id: owner.id, created_at: now });

      // Mudanca de estoque de variacao vira movimento, igual a contagem da
      // planilha. Sem isso o historico ficaria cego justamente no caminho que
      // o lojista mais usa para acertar quantidade de cor e voltagem.
      for (const linha of variacoes?.rows ?? []) {
        const antes = anteriores.get(linha.id)?.stock ?? 0;
        if (antes === linha.stock) continue;
        draft.inventoryMovements.unshift({
          id: randomUUID(), product_id: id, variant_id: linha.id,
          quantity_delta: linha.stock - antes, stock_before: antes, stock_after: linha.stock,
          reason: anteriores.has(linha.id) ? "correction" : "initial_import",
          note: `${variacoes!.axis}: ${linha.label}`,
          commission_percent: 0, commission_cents: 0, actor_id: owner.id, created_at: now,
        });
      }
      draft.operations.product_meta[id] = { ncm, cost_cents: costCents, model, gtin };
      audit(draft, owner.id, before ? "product.updated" : "product.created", "product", id, before, product);
    });
    created = !before;
  } catch (error) {
    console.error("Falha ao salvar produto:", error);
    return catalogStorageError(error);
  }
  refreshCatalog();
  if (created) redirect(`/painel/produtos/${encodeURIComponent(id)}?created=1`);
  return { ok: true, message: "Produto salvo com sucesso." };
}

export async function archiveProductAction(formData: FormData) {
  const owner = await ownerOrThrow();
  const id = String(formData.get("id") ?? "");
  await mutateCatalogState((state) => {
    const product = state.products.find((item) => item.id === id);
    if (!product) return;
    const before = { ...product };
    product.status = "archived";
    product.updated_at = new Date().toISOString();
    audit(state, owner.id, "product.archived", "product", id, before, product);
  });
  refreshCatalog();
}

export async function removeProductImageAction(formData: FormData) {
  const owner = await ownerOrThrow();
  const imageId = String(formData.get("imageId") ?? "");
  let storagePath: string | null = null;
  await mutateCatalogState((state) => {
    for (const product of state.products) {
      const image = product.product_images?.find((item) => item.id === imageId);
      if (!image) continue;
      storagePath = image.storage_path;
      product.product_images = product.product_images?.filter((item) => item.id !== imageId);
      if (image.is_primary && product.product_images?.[0]) product.product_images[0].is_primary = true;
      product.updated_at = new Date().toISOString();
      audit(state, owner.id, "product.image_removed", "product", product.id, image, null);
      break;
    }
  });
  if (storagePath) await deleteCatalogImage(storagePath);
  refreshCatalog();
}

export async function setPrimaryImageAction(formData: FormData) {
  const owner = await ownerOrThrow();
  const imageId = String(formData.get("imageId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  await mutateCatalogState((state) => {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    product.product_images?.forEach((image) => { image.is_primary = image.id === imageId; });
    product.updated_at = new Date().toISOString();
    audit(state, owner.id, "product.primary_image_changed", "product", productId, null, { imageId });
  });
  refreshCatalog();
}

export async function adjustInventoryAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const productId = String(formData.get("productId") ?? "");
  const reason = String(formData.get("reason") ?? "manual_adjustment");
  const enteredDelta = Math.trunc(numberFrom(formData.get("quantityDelta")));
  const delta = reason === "sale" ? -Math.abs(enteredDelta) : enteredDelta;
  const note = String(formData.get("note") ?? "").trim();
  const commissionPercent = Math.max(0, Math.min(100, Number(formData.get("commissionPercent") ?? 0) || 0));
  if (!productId || !delta) return { message: "Escolha um produto e informe uma quantidade diferente de zero." };
  if (!note) return { message: "Explique o motivo do ajuste." };
  let actionError = "";
  try { await mutateCatalogState((state) => {
    const product = state.products.find((item) => item.id === productId);
    if (!product) { actionError = "Produto nao encontrado."; return; }
    const after = product.stock + delta;
    if (after < 0) { actionError = "O estoque nao pode ficar negativo."; return; }
    const before = product.stock;
    const now = new Date().toISOString();
    const commissionCents = reason === "sale" ? Math.round(product.price_cents * Math.abs(delta) * commissionPercent / 100) : 0;
    product.stock = after;
    product.updated_at = now;
    if (delta > 0) product.last_stock_entry_at = now;
    if (reason === "sale") product.last_sale_at = now;
    state.inventoryMovements.unshift({ id: randomUUID(), product_id: productId, quantity_delta: delta, stock_before: before, stock_after: after, reason, note, commission_percent: commissionPercent, commission_cents: commissionCents, actor_id: owner.id, created_at: now });
    audit(state, owner.id, "inventory.adjusted", "product", productId, { stock: before }, { stock: after, reason, note, commissionPercent, commissionCents });
  }); } catch (error) {
    console.error("Falha ao atualizar estoque:", error);
    return inventoryActionError(error);
  }
  if (actionError) return { message: actionError };
  refreshCatalog();
  return { ok: true, message: "Estoque atualizado." };
}

/** Saves only the rows whose counted stock changed. The expected value protects against stale sheets. */
export async function saveInventoryCountsAction(updates: unknown): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const parsed = z.array(inventoryCountInput).max(200).safeParse(updates);
  if (!parsed.success) return { message: "Revise os valores de estoque informados." };
  if (!parsed.data.length) return { ok: true, message: "Nenhuma contagem para salvar." };
  try {
    let changed = 0;
    await mutateCatalogState((state) => { changed = applyInventoryCounts(state, parsed.data, owner.id); });
    refreshCatalog();
    return { ok: true, message: `${changed === 1 ? "1 produto atualizado" : `${changed} produtos atualizados`} com sucesso.` };
  } catch (error) {
    return inventoryActionError(error);
  }
}

/** Registers several sales at once and is safe to retry with the same batch id. */
export async function registerDailySalesAction(batchId: unknown, updates: unknown): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const parsedBatchId = z.string().regex(/^[a-zA-Z0-9_-]{8,120}$/).safeParse(batchId);
  const parsed = z.array(dailySaleInput).min(1).max(200).safeParse(updates);
  if (!parsedBatchId.success || !parsed.success) return { message: "Revise as saídas informadas e tente novamente." };
  try {
    let result = { products: 0, units: 0, alreadyApplied: false };
    await mutateCatalogState((state) => { result = applyDailySales(state, parsed.data, owner.id, parsedBatchId.data); });
    refreshCatalog();
    if (result.alreadyApplied) return { ok: true, message: "Essa saída já havia sido registrada." };
    return { ok: true, message: `${result.units} ${result.units === 1 ? "unidade baixada" : "unidades baixadas"} em ${result.products} ${result.products === 1 ? "produto" : "produtos"}.` };
  } catch (error) {
    return inventoryActionError(error);
  }
}

export async function createOrderAction(input: unknown): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const parsed = orderInput.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Revise os dados do pedido." };
  const { leadId, ...pedido } = parsed.data;
  try {
    const state = await readCatalogState(true);
    // O atendimento de origem so entra no pedido se ainda existe e nao
    // acompanha outro pedido vivo (um cancelado libera). Atendimento que sumiu
    // nao impede a venda: o pedido sai sem vinculo e a mensagem avisa. No
    // reenvio do mesmo pedido (mesmo requestId) o atendimento ja aponta para
    // ele, e isso nao e "outro pedido".
    const atendimento = leadId ? await findLead(leadId) : null;
    const reenviado = state.operations.orders.find((order) => order.request_id === pedido.requestId);
    const pedidoAtual = atendimento?.order_id ? state.operations.orders.find((order) => order.id === atendimento.order_id) : undefined;
    const vinculavel = atendimento && (!atendimento.order_id || atendimento.order_id === reenviado?.id || !pedidoAtual || pedidoAtual.status === "cancelled") ? atendimento : null;
    // O select do painel so oferece as origens do painel; a do atendimento de
    // origem (Shopee, Mercado Livre...) entra como opcao extra e vale tambem.
    if (!PANEL_TRAFFIC_SOURCES.some((valor) => valor === pedido.source) && pedido.source !== vinculavel?.source) {
      return { message: "Escolha como o cliente chegou até a loja." };
    }

    // Pedido, baixa de estoque e auditoria vao numa transacao so, direto na
    // tabela — sem passar pelo salvamento do catalogo inteiro. A campanha do
    // atendimento vai junto: e ela que poe a venda na linha certa do relatorio
    // de trafego por campanha.
    const created = await createSalesOrder(state, { ...pedido, leadId: vinculavel?.id ?? null, attribution: vinculavel?.attribution ?? {} }, owner.id);

    // A venda ja esta gravada: o vinculo com o atendimento (que vira Ganho) e
    // best-effort. Se falhar, a frase volta em `warning`, para a tela mostrar
    // como alerta e nao na faixa verde de sucesso.
    let recado = "";
    let aviso: string | undefined;
    if (leadId) {
      const vinculo = vinculavel
        ? await linkLeadToOrder(vinculavel.id, created, state, owner.id)
        : { ok: false, message: "O atendimento de origem não existe mais ou já acompanha outro pedido: o pedido foi criado sem vínculo." };
      if (vinculo.ok) recado = ` ${vinculo.message}`;
      else aviso = vinculo.message;
      revalidatePath("/painel/atendimento");
    }
    refreshCatalog();
    revalidatePath("/painel/pedidos");
    revalidatePath("/painel/financeiro");
    revalidatePath("/painel/trafego");
    revalidatePath("/painel/clientes");
    return { ok: true, message: `Pedido ${created.number} finalizado. O estoque foi atualizado.${recado}`, warning: aviso, orderId: created.id, orderNumber: created.number };
  } catch (error) {
    if (error instanceof OrderOperationError) return { message: error.message };
    return catalogStorageError(error);
  }
}

export async function confirmOrderAction(formData: FormData) {
  const owner = await ownerOrThrow();
  const orderId = String(formData.get("orderId") ?? "").trim();
  const sellerId = String(formData.get("sellerId") ?? "").trim();
  if (!orderId || !sellerId) return;
  // O redirect fica FORA do try de proposito: ele funciona lancando
  // NEXT_REDIRECT, e dentro do try o proprio catch o engolia — o pedido era
  // confirmado e mesmo assim aparecia "nao foi possivel confirmar".
  let destino: string;
  try {
    const order = await confirmPendingSalesOrder(await readCatalogState(true), orderId, sellerId, owner.id);
    // O atendimento do pedido vira "Ganho" com quem confirmou. Best-effort: a
    // venda ja esta gravada e nao volta atras por causa do CRM.
    await closeLeadsOfOrders([order], { stage: "won", seller: { id: order.seller_id, name: order.seller_name } }, owner.id);
    refreshCatalog();
    revalidatePath("/painel/pedidos");
    revalidatePath("/painel/financeiro");
    revalidatePath("/painel/atendimento");
    revalidatePath("/painel/trafego");
    revalidatePath("/painel/clientes");
    destino = `/painel/pedidos?confirmado=${encodeURIComponent(orderId)}`;
  } catch (error) {
    const mensagem = error instanceof OrderOperationError ? error.message : "Não foi possível confirmar o pedido agora.";
    destino = `/painel/pedidos?erro=${encodeURIComponent(mensagem)}`;
  }
  redirect(destino);
}

export async function cancelOrderAction(formData: FormData) {
  const owner = await ownerOrThrow();
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) return;
  let destino: string;
  try {
    const order = await cancelSalesOrder(await readCatalogState(true), orderId, owner.id);
    // Venda que nao aconteceu: o atendimento vinculado fecha como perdido.
    await closeLeadsOfOrders([order], { stage: "lost", note: "Pedido cancelado" }, owner.id);
    refreshCatalog();
    revalidatePath("/painel/pedidos");
    revalidatePath("/painel/financeiro");
    revalidatePath("/painel/atendimento");
    revalidatePath("/painel/trafego");
    revalidatePath("/painel/clientes");
    destino = `/painel/pedidos?cancelado=${encodeURIComponent(orderId)}`;
  } catch (error) {
    const mensagem = error instanceof OrderOperationError ? error.message : "Não foi possível cancelar o pedido agora.";
    destino = `/painel/pedidos?erro=${encodeURIComponent(mensagem)}`;
  }
  redirect(destino);
}

/**
 * Define quem cuida de um pedido do site que ainda aguarda confirmação — sem
 * confirmar e sem mexer no estoque. `sellerId` vazio devolve o pedido à fila
 * livre.
 *
 * O atendimento vinculado ao pedido acompanha a troca (best-effort), para a
 * tela de Atendimento mostrar a mesma pessoa que a de Pedidos.
 */
export async function assignOrderAction(formData: FormData) {
  const owner = await ownerOrThrow();
  const orderId = String(formData.get("orderId") ?? "").trim();
  const sellerId = String(formData.get("sellerId") ?? "").trim();
  const volta = String(formData.get("volta") ?? "").trim();
  if (!orderId) return;

  // Volta para a mesma lista (busca e filtros) em vez de jogar o operador na
  // lista cheia a cada atribuição.
  const base = volta.startsWith("/painel/pedidos") ? volta : "/painel/pedidos";
  const separador = base.includes("?") ? "&" : "?";
  let destino: string;
  try {
    const escolha = await resolverAtendente(owner.sellerId, sellerId);
    if (escolha.message) {
      destino = `${base}${separador}erro=${encodeURIComponent(escolha.message)}`;
    } else {
      const pedido = (await readCatalogState(true)).operations.orders.find((item) => item.id === orderId);
      if (!pedido) throw new OrderOperationError("Pedido não encontrado.");
      const { order, changed } = await assignPendingSalesOrder(pedido, escolha.seller, owner.id);
      // Mesmo sem mudança no pedido: se uma sincronização anterior falhou, reenviar
      // o formulário acerta o atendimento (a função não grava nada quando já bate).
      await assignLeadOfOrder(order.id, escolha.seller, owner.id);
      revalidatePath("/painel/pedidos");
      revalidatePath("/painel/atendimento");
      const mensagem = escolha.seller
        ? changed ? `Pedido ${order.number} com ${escolha.seller.name}.` : `O pedido ${order.number} já estava com ${escolha.seller.name}.`
        : changed ? `Pedido ${order.number} devolvido à fila livre.` : `O pedido ${order.number} já estava na fila livre.`;
      destino = `${base}${separador}feito=${encodeURIComponent(mensagem)}`;
    }
  } catch (error) {
    if (!(error instanceof OrderOperationError)) console.error("Falha ao atribuir pedido:", error);
    const mensagem = error instanceof OrderOperationError ? error.message : "Não foi possível atribuir o pedido agora.";
    destino = `${base}${separador}erro=${encodeURIComponent(mensagem)}`;
  }
  // Fora do try: redirect() funciona lançando NEXT_REDIRECT e o catch o engoliria.
  redirect(destino);
}

export async function saveCategoryAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const parsed = categorySchema.safeParse({ id: formData.get("id") || formData.get("slug"), name: formData.get("name"), slug: formData.get("slug"), description: formData.get("description"), icon: formData.get("icon"), sortOrder: Math.trunc(numberFrom(formData.get("sortOrder"))), inMainMenu: formData.get("inMainMenu") === "on", active: formData.get("active") === "on" });
  if (!parsed.success) return validationState(parsed.error.flatten().fieldErrors);
  const value = parsed.data;
  const current = await readCatalogState();
  if (current.categories.some((category) => category.id !== value.id && category.slug === value.slug)) return { message: "Ja existe uma categoria com este endereco." };
  await mutateCatalogState((state) => {
    const index = state.categories.findIndex((category) => category.id === value.id);
    const before = index >= 0 ? { ...state.categories[index] } : null;
    const category = { id: value.id, name: value.name, slug: value.slug, description: value.description, icon: value.icon, sort_order: value.sortOrder, in_main_menu: value.inMainMenu, active: value.active };
    if (index >= 0) state.categories[index] = category; else state.categories.push(category);
    audit(state, owner.id, before ? "category.updated" : "category.created", "category", value.id, before, category);
  });
  refreshCatalog();
  return { ok: true, message: "Categoria salva." };
}

export async function saveSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const keys: Array<Exclude<keyof StoreSettings, "catalogEnabled" | "cardFeeTable" | "cardInstallmentsHeadline">> = ["supportEmail", "supportHours", "cnpj", "fiscalAddress", "whatsappDisplay", "whatsappNumber", "instagramUrl", "shopeeUrl", "googleUrl", "googleRating", "googleRatingCount", "googleVerifiedAt", "leadDistributionMode"];
  const parcelamento = readParcelamento(formData);
  if (!parcelamento.ok) return { message: parcelamento.message };
  await mutateCatalogState((state) => {
    const before = { ...state.settings };
    for (const key of keys) state.settings[key] = String(formData.get(key) ?? "").trim();
    state.settings.cardFeeTable = taxasParaTexto(parcelamento.taxas);
    state.settings.cardInstallmentsHeadline = String(parcelamento.anunciarAte);
    // Valor fora da lista (form adulterado ou versao antiga) volta ao padrao.
    state.settings.leadDistributionMode = normalizeLeadDistributionMode(state.settings.leadDistributionMode);
    audit(state, owner.id, "settings.updated", "settings", "store", before, state.settings);
  });
  refreshCatalog();
  return { ok: true, message: "Configuracoes salvas." };
}

/**
 * Tabela da maquininha (`cardFee_1` = 1x ...) e chamada do preço de
 * Configurações. Mesma validação que o formulário faz antes de enviar
 * (`validarTabelaDigitada`); aqui ela segura form adulterado ou antigo.
 */
function readParcelamento(formData: FormData): { ok: true; taxas: number[]; anunciarAte: number } | { ok: false; message: string } {
  const valores = Array.from({ length: MAX_PARCELAS }, (_, indice) => String(formData.get(`cardFee_${indice + 1}`) ?? ""));
  const tabela = validarTabelaDigitada(valores);
  if (!tabela.ok) return { ok: false, message: tabela.mensagem };
  if (tabela.taxas.length < 2) return { ok: true, taxas: tabela.taxas, anunciarAte: ANUNCIAR_ATE_PADRAO };
  const anunciarAte = Number(formData.get("cardInstallmentsHeadline"));
  if (!Number.isInteger(anunciarAte) || anunciarAte < 2 || anunciarAte > tabela.taxas.length) {
    return { ok: false, message: `Anunciar junto do preço: escolha de 2 a ${tabela.taxas.length} vezes (a última da tabela).` };
  }
  return { ok: true, taxas: tabela.taxas, anunciarAte };
}

// `name` vem primeiro de proposito: o zod reporta a primeira falha na ordem das
// chaves e o formulario nao tem campo de identificador — mandar o dono revisar o
// "identificador" de um nome curto nao lhe daria nada para corrigir.
const sellerInput = z.object({
  name: z.string().trim().min(2, "Informe o nome do atendente.").max(80, "O nome do atendente pode ter no máximo 80 caracteres."),
  id: z.string().regex(SELLER_ID_PATTERN, "O identificador do atendente deve ter de 2 a 40 caracteres: letras minúsculas, números ou hífen."),
  roleLabel: z.string().trim().max(40, "A função pode ter no máximo 40 caracteres."),
  whatsappNumber: z.string().transform(onlyDigits).refine((value) => value.length === 0 || (value.length >= 12 && value.length <= 13), "O WhatsApp do atendente precisa ter DDI, DDD e número (12 ou 13 dígitos) ou ficar em branco."),
  whatsappDisplay: z.string().trim().max(30, "O número exibido pode ter no máximo 30 caracteres."),
  receivesLeads: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
});

/**
 * Salva a lista de atendentes de Configuracoes.
 *
 * Cada linha do formulario vem com um `sellerRow` (chave da linha) e os campos
 * `seller-<chave>-*`; checkbox desmarcado nao e enviado, por isso a leitura e
 * por linha e nao por `getAll`. Linha existente manda o id escondido; linha
 * nova recebe o id a partir do nome. Quem ja tem pedido nao pode sair da
 * lista — so ser desativado — porque `sales_orders.seller_id` e texto sem FK
 * e o relatorio ficaria orfao.
 */
export async function saveSellersAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const chaves = formData.getAll("sellerRow").map((value) => String(value)).filter(Boolean);
  if (!chaves.length) return { message: "Cadastre pelo menos um atendente." };

  // A leitura tambem fica no try: o formulario mostra o resultado com
  // `setFeedback(result)`, entao uma falha de storage aqui virava promessa
  // rejeitada e o dono ficava sem mensagem nenhuma, so com o botao travado.
  try {
    const state = await readCatalogState(true);
    const atuais = new Map(state.operations.sellers.map((seller) => [seller.id, seller]));
    const pedidosPorAtendente = new Map<string, number>();
    for (const order of state.operations.orders) {
      const id = canonicalSellerId(order.seller_id);
      pedidosPorAtendente.set(id, (pedidosPorAtendente.get(id) ?? 0) + 1);
    }

    const lista: SellerRecord[] = [];
    for (const chave of chaves) {
      const campo = (nome: string) => String(formData.get(`seller-${chave}-${nome}`) ?? "");
      const name = campo("name").trim();
      const idInformado = campo("id").trim().toLowerCase();
      // Canonico antes da checagem de duplicata: um "Dom Guima" novo viraria
      // o id legado e se fundiria com o dono em silencio.
      const id = canonicalSellerId(idInformado || sellerIdFromName(name));
      // Linha nova nao manda identificador: ele sai do nome. Nome que nao gera
      // identificador (sem letra nem numero latino) tem de reclamar do NOME,
      // o unico campo que o dono pode corrigir na tela.
      if (!idInformado && name.length >= 2 && !SELLER_ID_PATTERN.test(id)) {
        return { message: `Use um nome com pelo menos 2 letras ou números para o atendente “${name}”.` };
      }
      if (!idInformado && RESERVED_SELLER_IDS.includes(id)) {
        return { message: `O nome “${name}” é usado internamente pelo painel. Cadastre o atendente com outro nome (por exemplo, com o sobrenome).` };
      }
      const parsed = sellerInput.safeParse({
        name,
        id,
        roleLabel: campo("roleLabel"),
        whatsappNumber: campo("whatsappNumber"),
        whatsappDisplay: campo("whatsappDisplay"),
        receivesLeads: campo("receivesLeads") === "on",
        active: campo("active") === "on",
        sortOrder: Math.trunc(numberFrom(formData.get(`seller-${chave}-sortOrder`))),
      });
      if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Revise os dados dos atendentes." };
      const value = parsed.data;
      if (lista.some((seller) => seller.id === value.id)) return { message: `O atendente “${value.name}” está repetido na lista.` };
      lista.push({
        id: value.id,
        name: value.name,
        role_label: value.roleLabel || "Vendedor",
        whatsapp_number: value.whatsappNumber || null,
        whatsapp_display: value.whatsappDisplay,
        receives_leads: value.receivesLeads,
        active: value.active,
        sort_order: value.sortOrder,
      });
    }

    const ativos = lista.filter((seller) => seller.active);
    if (!ativos.length) return { message: "Mantenha pelo menos um atendente ativo: é ele quem assina os pedidos." };

    const idsEnviados = new Set(lista.map((seller) => seller.id));
    const removidoComPedidos = [...atuais.values()].find((seller) => !idsEnviados.has(seller.id) && (pedidosPorAtendente.get(seller.id) ?? 0) > 0);
    if (removidoComPedidos) {
      return { message: `“${removidoComPedidos.name}” já tem pedidos registrados e não pode ser removido. Desmarque “Ativo” para tirá-lo de circulação.` };
    }

    await mutateCatalogState((current) => {
      const before = current.operations.sellers;
      current.operations.sellers = lista.map((seller, index) => normalizeSeller(seller, index));
      audit(current, owner.id, "seller.updated", "seller", "all", before, current.operations.sellers);
    });
  } catch (error) {
    console.error("Falha ao salvar atendentes:", error);
    return catalogStorageError(error);
  }
  refreshCatalog();
  return { ok: true, message: "Atendentes salvos. O site já mostra a lista nova." };
}

// ---------------------------------------------------------------------------
// Atendimentos
// ---------------------------------------------------------------------------

const CRM_INDISPONIVEL = LEAD_CRM_UNAVAILABLE_MESSAGE;

const leadInput = z.object({
  customerName: z.string().trim().min(2, "Informe o nome do cliente.").max(140, "O nome do cliente pode ter no máximo 140 caracteres."),
  // Telefone em branco e aceito: cliente que chegou na loja fisica muitas vezes
  // so deixa o nome, e exigir o numero faria o atendente inventar um.
  customerPhone: z.string().transform(onlyDigits).refine((value) => value.length === 0 || (value.length >= 10 && value.length <= 13), "Informe um telefone com DDD ou deixe o campo em branco."),
  sellerId: z.string().trim().max(80),
  notes: z.string().trim().max(500, "A observação pode ter no máximo 500 caracteres."),
  // Sem o campo (formulario antigo em cache), o atendimento entra como direto,
  // como antes do controle de trafego.
  source: z.enum(PANEL_TRAFFIC_SOURCES, { error: "Escolha como o cliente chegou até a loja." }).default("direct"),
});

/**
 * Atendimento lancado a mao: cliente que chegou pela loja fisica, por indicacao
 * ou por uma conversa de WhatsApp que comecou fora do site.
 *
 * Diferente dos atendimentos do site, este PASSA auditoria: sao poucos por dia
 * e e util saber quem cadastrou. A origem e escolhida pelo operador — sem ela,
 * todo cliente da loja fisica somaria como "Direto" no relatorio de trafego.
 */
export async function createLeadAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const parsed = leadInput.safeParse({
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    sellerId: formData.get("sellerId"),
    notes: formData.get("notes"),
    source: formData.get("source") ?? undefined,
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Revise os dados do atendimento." };
  const value = parsed.data;

  let atendente: SellerRecord | null = null;
  try {
    const escolha = await resolverAtendente(owner.sellerId, value.sellerId);
    if (escolha.message) return { message: escolha.message };
    atendente = escolha.seller;

    const { lead } = await createLead(
      {
        kind: "manual",
        sellerId: atendente?.id ?? null,
        assignedBy: atendente ? owner.id : null,
        customerName: value.customerName,
        customerPhone: value.customerPhone,
        notes: value.notes,
        source: value.source,
        createdBy: owner.id,
      },
      {
        mode: "manual",
        audit: {
          actor_id: owner.id,
          action: "lead.created",
          after_data: { cliente: value.customerName, atendente: atendente?.name ?? "Fila livre", origem: trafficSourceLabel(value.source) },
        },
      },
    );
    if (!lead) return { message: CRM_INDISPONIVEL };
  } catch (error) {
    console.error("Falha ao registrar atendimento:", error);
    return { message: "Não foi possível registrar o atendimento agora. Tente novamente em instantes." };
  }

  revalidatePath("/painel/atendimento");
  revalidatePath("/painel/trafego");
  return { ok: true, message: atendente ? `Atendimento registrado para ${atendente.name}.` : "Atendimento registrado na fila livre." };
}

/**
 * Puxar para mim, transferir para outro atendente ou devolver a fila livre.
 *
 * `sellerId` aceita "me" (o atendente vinculado ao login), vazio (fila livre)
 * ou o id de um atendente ativo.
 */
export async function assignLeadAction(formData: FormData) {
  const owner = await ownerOrThrow();
  const leadId = String(formData.get("leadId") ?? "").trim();
  const sellerId = String(formData.get("sellerId") ?? "").trim();
  const volta = String(formData.get("volta") ?? "").trim();
  if (!leadId) return;

  const base = volta.startsWith("/painel/atendimento") ? volta : "/painel/atendimento";
  const separador = base.includes("?") ? "&" : "?";
  let destino: string;
  try {
    const escolha = await resolverAtendente(owner.sellerId, sellerId);
    // Atendimento de pedido ja confirmado ou cancelado fica com quem cuidou do
    // pedido (e responde pela comissao): trocar so o atendimento desalinharia
    // Atendimento e Pedidos.
    const impedimento = escolha.message ?? (await orderLockForLead(leadId));
    if (impedimento) {
      destino = `${base}${separador}erro=${encodeURIComponent(impedimento)}`;
    } else {
      const { found, unavailable, lead } = await updateLead(
        leadId,
        { seller_id: escolha.seller?.id ?? null, assigned_by: owner.id },
        {
          actor_id: owner.id,
          action: "lead.assigned",
          after_data: { atendente: escolha.seller?.name ?? "Fila livre" },
        },
      );
      // Atendimento de pedido do site ainda pendente (os de pedido fechado foram
      // barrados acima): o pedido acompanha, para Pedidos e Atendimento
      // apontarem a mesma pessoa.
      if (lead?.order_id) {
        await assignOrderOfLead(lead, escolha.seller, owner.id);
        revalidatePath("/painel/pedidos");
      }
      // "Nao encontrei o atendimento" e "a tabela nao existe" sao problemas
      // diferentes: mandar aplicar uma migration quando o operador so clicou
      // numa linha que outra pessoa ja tinha mexido confunde mais do que ajuda.
      const mensagem = unavailable
        ? CRM_INDISPONIVEL
        : !found
          ? "Este atendimento não existe mais. Atualize a página."
          : escolha.seller
            ? `Atendimento com ${escolha.seller.name}.`
            : "Atendimento devolvido à fila livre.";
      destino = `${base}${separador}${found ? "feito" : "erro"}=${encodeURIComponent(mensagem)}`;
    }
    revalidatePath("/painel/atendimento");
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    console.error("Falha ao redistribuir atendimento:", error);
    destino = `${base}${separador}erro=${encodeURIComponent("Não foi possível redistribuir o atendimento agora.")}`;
  }
  // Fora do try: redirect() funciona lancando NEXT_REDIRECT e o catch o engoliria.
  redirect(destino);
}

const leadStageInput = z.object({
  leadId: z.string().trim().min(1, "Atendimento não informado.").max(80),
  stage: z.enum(LEAD_STAGES, { error: "Escolha uma etapa válida." }),
  lostReason: z.enum(LEAD_LOST_REASONS, { error: "Escolha um motivo da perda da lista." }).optional(),
}).refine((value) => value.stage !== "lost" || Boolean(value.lostReason), { message: "Escolha o motivo da perda.", path: ["lostReason"] });

/**
 * Move o atendimento no funil: Novo → Em atendimento → Orçamento enviado →
 * Aguardando pagamento → Ganho ou Perdido (com motivo obrigatório).
 *
 * E a etapa que o modo "menos ocupado" le para decidir quem recebe o proximo
 * atendimento: Ganho e Perdido deixam de contar como carga. `OrderStatus` nao
 * muda aqui — pedido so se confirma ou cancela em Pedidos.
 */
export async function changeLeadStageAction(formData: FormData) {
  const owner = await ownerOrThrow();
  const volta = String(formData.get("volta") ?? "").trim();
  const parsed = leadStageInput.safeParse({
    leadId: String(formData.get("leadId") ?? ""),
    stage: String(formData.get("stage") ?? ""),
    // Select de motivo vazio (ou ausente, fora de "Perdido") = sem motivo.
    lostReason: String(formData.get("lostReason") ?? "").trim() || undefined,
  });

  let destino: string;
  if (!parsed.success) {
    destino = voltaParaAtendimento(volta, "erro", parsed.error.issues[0]?.message ?? "Revise a etapa escolhida.");
  } else {
    const { leadId, stage, lostReason } = parsed.data;
    try {
      // Pedido ja confirmado prende a etapa em Ganho; pedido pendente so ganha
      // um lembrete na mensagem.
      const conferencia = await checkLeadStageChange(leadId, stage);
      if (conferencia.blocker) {
        destino = voltaParaAtendimento(volta, "erro", conferencia.blocker);
      } else {
        const motivo = stage === "lost" && lostReason ? lostReason : null;
        const { found, unavailable } = await updateLead(
          leadId,
          { stage, lost_reason: motivo },
          {
            actor_id: owner.id,
            action: "lead.stage_changed",
            after_data: { etapa: LEAD_STAGE_LABELS[stage], ...(motivo ? { motivo: LEAD_LOST_REASON_LABELS[motivo] } : {}) },
          },
        );
        // A frase vai para a URL (?feito=): nada de nome de cliente nela.
        destino = unavailable
          ? voltaParaAtendimento(volta, "erro", CRM_INDISPONIVEL)
          : !found
            ? voltaParaAtendimento(volta, "erro", "Este atendimento não existe mais. Atualize a página.")
            : voltaParaAtendimento(volta, "feito", `Atendimento movido para “${LEAD_STAGE_LABELS[stage]}”${motivo ? ` (${LEAD_LOST_REASON_LABELS[motivo]})` : ""}.${conferencia.hint}`);
      }
      revalidatePath("/painel/atendimento");
      revalidatePath("/painel/clientes");
      revalidatePath("/painel");
    } catch (error) {
      console.error("Falha ao mudar a etapa do atendimento:", error);
      destino = voltaParaAtendimento(volta, "erro", "Não foi possível mudar a etapa agora. Tente novamente em instantes.");
    }
  }
  // Fora do try: redirect() funciona lancando NEXT_REDIRECT e o catch o engoliria.
  redirect(destino);
}

const leadLinkInput = z.object({
  leadId: z.string().trim().min(1, "Atendimento não informado.").max(80),
  orderNumber: z.string().trim().min(3, "Informe o número do pedido, como DG-20260922-001.").max(40, "Número de pedido longo demais."),
});

/**
 * "Vincular a pedido": liga o atendimento a um pedido pelo número (DG-…).
 *
 * Pedido finalizado fecha o atendimento como Ganho; pedido aguardando
 * confirmação fica ligado e fecha sozinho na confirmação ou no cancelamento. As
 * regras (um pedido por atendimento, quem herda o atendente) moram em
 * `linkLeadToOrder`, também usada pelo Novo pedido lançado a partir do
 * atendimento.
 */
export async function linkLeadToOrderAction(formData: FormData) {
  const owner = await ownerOrThrow();
  const volta = String(formData.get("volta") ?? "").trim();
  const parsed = leadLinkInput.safeParse({
    leadId: String(formData.get("leadId") ?? ""),
    orderNumber: String(formData.get("orderNumber") ?? ""),
  });

  let destino: string;
  if (!parsed.success) {
    destino = voltaParaAtendimento(volta, "erro", parsed.error.issues[0]?.message ?? "Informe o número do pedido.");
  } else {
    try {
      const state = await readCatalogState(true);
      const pedido = findOrderByNumber(state.operations.orders, parsed.data.orderNumber);
      if (!pedido) {
        destino = voltaParaAtendimento(volta, "erro", `Pedido “${parsed.data.orderNumber}” não encontrado. Confira o número em Pedidos.`);
      } else {
        const resultado = await linkLeadToOrder(parsed.data.leadId, pedido, state, owner.id);
        destino = voltaParaAtendimento(volta, resultado.ok ? "feito" : "erro", resultado.message);
        revalidatePath("/painel/atendimento");
        revalidatePath("/painel/pedidos");
        revalidatePath("/painel/clientes");
        revalidatePath("/painel");
      }
    } catch (error) {
      console.error("Falha ao vincular atendimento a pedido:", error);
      destino = voltaParaAtendimento(volta, "erro", "Não foi possível vincular o atendimento agora. Tente novamente em instantes.");
    }
  }
  redirect(destino);
}

const leadCustomerInput = z.object({
  leadId: z.string().trim().min(1, "Atendimento não informado.").max(80),
  customerName: z.string().trim().max(140, "O nome do cliente pode ter no máximo 140 caracteres."),
  // Com ou sem o 55 e a pontuação; o que vale é sobrar um número com DDD.
  customerPhone: z.string().transform(onlyDigits).refine((value) => value.length === 0 || [10, 11].includes(phoneKey(value).length), "Informe o telefone com DDD, como (34) 99999-9999, ou deixe em branco."),
  customerDocument: z.string().transform(onlyDigits).refine((value) => value.length === 0 || isValidDocument(value), "CPF ou CNPJ inválido. Confira os números ou deixe em branco."),
}).refine((value) => Boolean(value.customerName || value.customerPhone || value.customerDocument), { message: "Informe o telefone, o CPF/CNPJ ou o nome do cliente.", path: ["customerPhone"] });

/**
 * "Identificar cliente" de um atendimento: nome, telefone e/ou CPF/CNPJ que o
 * atendente descobriu na conversa.
 *
 * O clique no WhatsApp do site nasce sem telefone — o número do cliente só
 * aparece no aparelho de quem atende. Sem este passo, o atendimento mais comum
 * da loja nunca ganhava a etiqueta "Recorrente", ficava fora do aviso de
 * "atendimento em aberto" em Clientes e só era reconhecido se alguém o
 * vinculasse a um pedido. A chave gravada segue a mesma regra dos pedidos
 * (`customerKey`: telefone quando há, senão o documento); o documento não tem
 * coluna própria no atendimento, só vira a chave quando não há telefone.
 *
 * A auditoria registra que o cliente foi identificado, não o telefone nem o
 * CPF; a mensagem de volta vai na URL e também não os leva.
 */
export async function identifyLeadCustomerAction(formData: FormData) {
  const owner = await ownerOrThrow();
  const volta = String(formData.get("volta") ?? "").trim();
  const parsed = leadCustomerInput.safeParse({
    leadId: String(formData.get("leadId") ?? ""),
    customerName: String(formData.get("customerName") ?? ""),
    customerPhone: String(formData.get("customerPhone") ?? ""),
    customerDocument: String(formData.get("customerDocument") ?? ""),
  });

  let destino: string;
  if (!parsed.success) {
    destino = voltaParaAtendimento(volta, "erro", parsed.error.issues[0]?.message ?? "Revise os dados do cliente.");
  } else {
    const { leadId, customerName, customerPhone, customerDocument } = parsed.data;
    const chave = customerKey({ phone: customerPhone, cpf: customerDocument });
    try {
      const { found, unavailable } = await updateLead(
        leadId,
        { customer_name: customerName, customer_phone: customerPhone, customer_key: chave },
        {
          actor_id: owner.id,
          action: "lead.customer_updated",
          after_data: { cliente: customerName || "(sem nome)", identificacao: customerPhone ? "telefone" : customerDocument ? "CPF/CNPJ" : "só o nome" },
        },
      );
      destino = unavailable
        ? voltaParaAtendimento(volta, "erro", CRM_INDISPONIVEL)
        : !found
          ? voltaParaAtendimento(volta, "erro", "Este atendimento não existe mais. Atualize a página.")
          : voltaParaAtendimento(volta, "feito", chave ? "Cliente identificado no atendimento." : "Nome do cliente salvo no atendimento.");
      revalidatePath("/painel/atendimento");
      revalidatePath("/painel/clientes");
      revalidatePath("/painel");
    } catch (error) {
      console.error("Falha ao identificar o cliente do atendimento:", error);
      destino = voltaParaAtendimento(volta, "erro", "Não foi possível salvar os dados do cliente agora. Tente novamente em instantes.");
    }
  }
  // Fora do try: redirect() funciona lancando NEXT_REDIRECT e o catch o engoliria.
  redirect(destino);
}

/**
 * Volta para a mesma lista de Atendimento (aba e filtros) com a faixa de
 * resultado. Só aceita caminhos do próprio painel de atendimento.
 */
function voltaParaAtendimento(volta: string, chave: "feito" | "erro", mensagem: string): string {
  const base = volta.startsWith("/painel/atendimento") ? volta : "/painel/atendimento";
  return `${base}${base.includes("?") ? "&" : "?"}${chave}=${encodeURIComponent(mensagem)}`;
}

const customerLookupInput = z.object({
  phone: z.string().trim().max(30),
  cpf: z.string().trim().max(30),
});

const SEM_HISTORICO: CustomerPurchaseLookup = { phonePurchases: 0, documentPurchases: 0, reference: null };

/**
 * "Este telefone/CPF já comprou N vezes" do Novo pedido: o formulário pergunta
 * por UM cliente, enquanto o operador digita, em vez de receber a tabela de
 * todos os telefones e CPFs da loja. Só leitura e best-effort: qualquer falha
 * responde "sem histórico" e o pedido segue normalmente.
 */
export async function customerPurchasesAction(input: unknown): Promise<CustomerPurchaseLookup> {
  await ownerOrThrow();
  const parsed = customerLookupInput.safeParse(input);
  if (!parsed.success) return SEM_HISTORICO;
  try {
    return await getCustomerPurchases(parsed.data);
  } catch (error) {
    console.warn("Nao foi possivel conferir o historico do cliente:", error);
    return SEM_HISTORICO;
  }
}

const customerContactInput = z.object({
  // O cliente vem pelo número de um pedido dele (DG-…), como nos links entre
  // as telas: telefone e CPF não viajam no formulário.
  cliente: z.string().trim().min(3, "Cliente não informado.").max(40, "Número de pedido longo demais."),
  contato: z.enum(["recusar", "permitir"], { error: "Escolha se o cliente aceita ou recusa o recontato." }),
});

/** Cliente do link não existe mais na lista de pedidos: aborta a gravação sem escrever nada. */
class ClienteNaoEncontrado extends Error {}

/**
 * "Não quer recontato" / "Permitir recontato" da tela de Clientes.
 *
 * A política de privacidade promete que quem pedir pelo WhatsApp para não
 * receber o contato pós-compra deixa de ser chamado. Sem esta marca, a lista de
 * sugestões continuava oferecendo o cliente, com a mensagem pronta no botão.
 *
 * Todas as identidades do cliente (telefones e CPF/CNPJ, inclusive os antigos)
 * entram na lista: quem trocou de número continua fora das sugestões. A lista
 * mora no JSONB privado das configurações, ao lado dos atendentes.
 */
export async function customerContactAction(formData: FormData) {
  const owner = await ownerOrThrow();
  const volta = String(formData.get("volta") ?? "").trim();
  const parsed = customerContactInput.safeParse({
    cliente: String(formData.get("cliente") ?? ""),
    contato: String(formData.get("contato") ?? ""),
  });

  let destino: string;
  if (!parsed.success) {
    destino = voltaParaClientes(volta, "erro", parsed.error.issues[0]?.message ?? "Revise o pedido do cliente.");
  } else {
    const { cliente, contato } = parsed.data;
    try {
      await mutateCatalogState((state) => {
        const indice = buildCustomerIndex(state.operations.orders);
        const chave = indice.keyOfOrderNumber(cliente);
        if (!chave) throw new ClienteNaoEncontrado();
        const identidades = indice.identitiesOf(chave);
        const recusas = new Set(state.operations.contact_opt_outs);
        for (const identidade of identidades.length ? identidades : [chave]) {
          if (contato === "recusar") recusas.add(identidade);
          else recusas.delete(identidade);
        }
        state.operations.contact_opt_outs = [...recusas];
        // Só o número do pedido e a decisão: nada de telefone ou CPF no histórico.
        audit(state, owner.id, contato === "recusar" ? "customer.contact_opt_out" : "customer.contact_opt_in", "customer", cliente, null, { recontato: contato === "recusar" ? "recusado pelo cliente" : "permitido de novo" });
      });
      destino = voltaParaClientes(volta, "feito", contato === "recusar"
        ? "Anotado: este cliente não aparece mais nas sugestões de recontato."
        : "Recontato permitido de novo para este cliente.");
      revalidatePath("/painel/clientes");
      revalidatePath("/painel");
    } catch (error) {
      if (error instanceof ClienteNaoEncontrado) {
        destino = voltaParaClientes(volta, "erro", `Nenhum cliente encontrado para o pedido ${cliente}. Atualize a página.`);
      } else {
        console.error("Falha ao salvar a preferência de recontato:", error);
        destino = voltaParaClientes(volta, "erro", "Não foi possível salvar agora. Tente novamente em instantes.");
      }
    }
  }
  // Fora do try: redirect() funciona lancando NEXT_REDIRECT e o catch o engoliria.
  redirect(destino);
}

/** Volta para a mesma lista de Clientes (filtros) com a faixa de resultado. */
function voltaParaClientes(volta: string, chave: "feito" | "erro", mensagem: string): string {
  const base = volta.startsWith("/painel/clientes") ? volta : "/painel/clientes";
  return `${base}${base.includes("?") ? "&" : "?"}${chave}=${encodeURIComponent(mensagem)}`;
}

/**
 * Traduz o valor do formulario ("me" | "" | id) no atendente de verdade.
 *
 * Devolve `message` preenchido quando o operador escolheu algo impossivel — o
 * login sem vinculo e o caso mais comum, e a mensagem precisa dizer como
 * resolver, porque o vinculo so existe pela CLI.
 */
async function resolverAtendente(ownerSellerId: string | null, escolhido: string): Promise<{ seller: SellerRecord | null; message?: string }> {
  if (escolhido === "me") {
    if (!ownerSellerId) return { seller: null, message: UNLINKED_LOGIN_HINT };
    const seller = await acharAtendenteAtivo(ownerSellerId);
    return seller ? { seller } : { seller: null, message: "O atendente vinculado a este login não está ativo." };
  }
  if (!escolhido) return { seller: null };
  const seller = await acharAtendenteAtivo(escolhido);
  return seller ? { seller } : { seller: null, message: "Escolha um atendente ativo." };
}

async function acharAtendenteAtivo(id: string): Promise<SellerRecord | null> {
  const procurado = canonicalSellerId(id.trim().toLowerCase());
  const sellers = (await readCatalogState()).operations.sellers;
  return sellers.find((seller) => seller.id === procurado && seller.active) ?? null;
}

export async function importCurrentCatalogAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await ownerOrThrow();
  if (formData.get("confirmation") !== "IMPORTAR") return { message: "Digite IMPORTAR para confirmar." };
  const initial = createInitialState();
  await mutateCatalogState((state) => {
    const productIds = new Set(state.products.map((product) => product.id));
    const categoryIds = new Set(state.categories.map((category) => category.id));
    const addedProducts = initial.products.filter((product) => !productIds.has(product.id));
    const addedCategories = initial.categories.filter((category) => !categoryIds.has(category.id));
    state.products.push(...addedProducts);
    state.categories.push(...addedCategories);
    audit(state, owner.id, "catalog.imported", "catalog", "current", null, { products: addedProducts.length, categories: addedCategories.length });
  });
  refreshCatalog();
  return { ok: true, message: "Catalogo atual ativado sem sobrescrever edicoes existentes." };
}

/**
 * Invalida o que o cliente ve depois de qualquer mudanca no catalogo.
 *
 * As paginas publicas sao geradas estaticamente (generateStaticParams). Sem
 * revalidar, elas ficavam congeladas no momento do build: preco, estoque e
 * variacao so chegavam na loja no proximo deploy. Foi assim que um produto
 * com 30 unidades em estoque continuou anunciado como indisponivel.
 *
 * Era uma lista fixa de caminhos ("/", "/produto/[slug]", ...) e ela envelhecia
 * a cada rota nova: a lista de atendentes passou a ser lida no layout raiz
 * (src/app/layout.tsx) e entra no payload de TODA rota, inclusive /conta,
 * /carrinho, /checkout/rapido e /institucional/[slug], que nao estavam na
 * lista e nao tem revalidate proprio — trocar o WhatsApp de um atendente nao
 * chegava nelas ate o proximo deploy. Revalidar o layout raiz cobre a arvore
 * inteira de uma vez (Next 16: o 2o parametro "layout" invalida o layout e
 * tudo aninhado nele).
 */
function refreshCatalog() {
  updateTag("catalog");

  // Site inteiro: o layout raiz e pai de todas as paginas publicas e do painel.
  revalidatePath("/", "layout");

  // Rota de metadata: gerada por src/app/sitemap.ts, fora da arvore do layout.
  revalidatePath("/sitemap.xml");
}

function audit(state: CatalogState, actorId: string, action: string, entityType: string, entityId: string, beforeData: unknown, afterData: unknown) {
  state.auditLogs.unshift({ id: randomUUID(), actor_id: actorId, action, entity_type: entityType, entity_id: entityId, before_data: beforeData, after_data: afterData, created_at: new Date().toISOString() });
  state.auditLogs = state.auditLogs.slice(0, 1000);
}

function splitCommaList(value: FormDataEntryValue | null): string[] { return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean); }
function parseSpecifications(value: FormDataEntryValue | null) { return String(value ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [label, ...rest] = line.split(":"); return { label: label.trim(), value: rest.join(":").trim() }; }).filter((item) => item.label && item.value); }
const variantRowInput = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(60),
  sku: z.string().trim().min(2).max(60),
  priceCents: z.number().int().positive().max(100_000_000),
  stock: z.number().int().min(0).max(1_000_000),
  active: z.boolean(),
  imageSrc: z.string().trim().max(600).nullable().optional(),
});

/**
 * Le a grade de variacoes enviada pela ficha do produto.
 *
 * Devolve `null` quando o produto nao tem variacao — diferente de lista vazia,
 * que significaria "tinha e o lojista apagou todas".
 */
function parseVariantRows(raw: FormDataEntryValue | null, productId: string): { axis: string; rows: AdminProductVariant[] } | null {
  const texto = String(raw ?? "").trim();
  if (!texto) return null;
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return null; }
  const parsed = z.object({
    axis: z.string().trim().min(1).max(40),
    rows: z.array(variantRowInput).min(1).max(60),
  }).safeParse(bruto);
  if (!parsed.success) return null;

  const vistos = new Set<string>();
  const rows: AdminProductVariant[] = [];
  for (const [indice, linha] of parsed.data.rows.entries()) {
    const sku = linha.sku.toUpperCase();
    // SKU repetido dentro do mesmo produto viraria erro de indice unico no
    // banco depois de a tela ja ter dito "salvo".
    if (vistos.has(sku)) continue;
    vistos.add(sku);
    rows.push({
      id: linha.id, product_id: productId, label: linha.label, sku,
      price_cents: linha.priceCents, stock: linha.stock, sort_order: indice, active: linha.active,
      image_src: linha.imageSrc || null,
    });
  }
  return rows.length ? { axis: parsed.data.axis, rows } : null;
}

function parseVariants(value: FormDataEntryValue | null) { return String(value ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [name, ...rest] = line.split(":"); return { name: name.trim(), options: rest.join(":").split(",").map((item) => item.trim()).filter(Boolean) }; }).filter((item) => item.name && item.options.length); }
function validationState(errors: Record<string, string[] | undefined>): ActionState { return { message: "Revise os campos destacados.", errors: Object.fromEntries(Object.entries(errors).filter((entry): entry is [string, string[]] => Boolean(entry[1]))) }; }
function catalogStorageError(error: unknown): ActionState {
  const message = error instanceof Error ? error.message : "";
  if (/suspended|blocked/i.test(message)) {
    return { message: "O armazenamento do catalogo esta suspenso na Vercel. Nenhuma alteracao foi perdida nesta tentativa. Reative o Blob e tente novamente." };
  }
  return { message: "Nao foi possivel acessar o armazenamento do catalogo. Nenhuma alteracao foi perdida nesta tentativa. Tente novamente em instantes." };
}

function inventoryActionError(error: unknown): ActionState {
  if (error instanceof InventoryOperationError) return { message: error.message };
  return catalogStorageError(error);
}

// ---------------------------------------------------------------------------
// Lancamento em lote a partir das mensagens do grupo de vendas
// ---------------------------------------------------------------------------

const bulkBlockInput = z.object({
  requestId: z.string().regex(/^[a-zA-Z0-9_-]{8,120}$/),
  // Canal reconhecido no cabecalho (vira canal/origem do pedido). A tela ja
  // manda sempre; sem ele (pagina antiga aberta), o bloco entra como "outro".
  channel: z.enum(BULK_CHANNELS).default("outro"),
  channelLabel: z.string().trim().min(1).max(120),
  customerName: z.string().trim().min(1).max(140),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  paid: z.boolean(),
  paymentMethod: z.enum(["pix", "credit_card", "debit_card", "boleto", "cash_on_delivery", "to_confirm"]),
  notes: z.array(z.string().trim().max(400)).max(40),
  items: z.array(z.object({
    productId: z.string().trim().min(1).max(200),
    variantId: z.string().trim().max(120).nullable().optional(),
    quantity: z.number().int().min(1).max(1_000),
    unitPriceCents: z.number().int().positive().max(100_000_000),
  })).min(1).max(100),
});

export interface BulkImportResult {
  ok: boolean;
  message: string;
  created: Array<{ requestId: string; number: string; customerName: string }>;
  failed: Array<{ requestId: string; channelLabel: string; message: string }>;
}

/**
 * Grava os lancamentos conferidos na tela de importacao.
 *
 * Cada bloco vira um pedido independente: um que falhe (produto sem estoque,
 * por exemplo) nao impede os outros de entrar, e a tela mostra exatamente qual
 * nao passou. Reenviar a mesma mensagem nao duplica — o `requestId` e derivado
 * do conteudo e o banco tem indice unico nele.
 */
export async function createBulkOrdersAction(sellerId: unknown, blocks: unknown): Promise<BulkImportResult> {
  const owner = await ownerOrThrow();
  const parsedSeller = z.string().trim().min(1).max(80).safeParse(sellerId);
  const parsed = z.array(bulkBlockInput).min(1).max(60).safeParse(blocks);
  if (!parsedSeller.success) return { ok: false, message: "Selecione um vendedor ativo.", created: [], failed: [] };
  if (!parsed.success) return { ok: false, message: "Revise os lançamentos: algum item está sem produto ou sem valor.", created: [], failed: [] };

  const repetidos = parsed.data.map((block) => block.requestId);
  if (new Set(repetidos).size !== repetidos.length) {
    return { ok: false, message: "Há dois lançamentos idênticos na lista. Remova a duplicata antes de gravar.", created: [], failed: [] };
  }

  const created: BulkImportResult["created"] = [];
  const failed: BulkImportResult["failed"] = [];

  for (const block of parsed.data) {
    try {
      // Leitura fresca a cada bloco: o anterior acabou de mexer no estoque.
      const order = await createChannelSalesOrder(await readCatalogState(true), {
        requestId: block.requestId,
        sellerId: parsedSeller.data,
        channel: block.channel,
        channelLabel: block.channelLabel,
        customerName: block.customerName,
        // Meio-dia para a data nao escorregar de dia por fuso.
        createdAt: block.date ? new Date(`${block.date}T15:00:00.000Z`).toISOString() : new Date().toISOString(),
        paid: block.paid,
        paymentMethod: block.paymentMethod,
        notes: block.notes,
        items: block.items.map((item) => ({ productId: item.productId, variantId: item.variantId ?? null, quantity: item.quantity, unitPriceCents: item.unitPriceCents })),
      }, owner.id);
      created.push({ requestId: block.requestId, number: order.number, customerName: block.customerName });
    } catch (error) {
      const message = error instanceof OrderOperationError ? error.message : "Não foi possível gravar este lançamento agora.";
      failed.push({ requestId: block.requestId, channelLabel: block.channelLabel, message });
    }
  }

  if (created.length) {
    refreshCatalog();
    revalidatePath("/painel/pedidos");
    revalidatePath("/painel/financeiro");
    revalidatePath("/painel/historico");
    revalidatePath("/painel/trafego");
    revalidatePath("/painel/clientes");
  }

  const resumo = created.length === 1 ? "1 pedido gerado" : `${created.length} pedidos gerados`;
  return {
    ok: failed.length === 0,
    message: failed.length === 0
      ? `${resumo}. O estoque e a comissão foram atualizados.`
      : `${resumo}, ${failed.length} com problema. Confira abaixo.`,
    created,
    failed,
  };
}

// ---------------------------------------------------------------------------
// Duplicar produto
// ---------------------------------------------------------------------------

/** Garante endereco livre no catalogo: "copo-stanley-copia", "-copia-2"... */
function slugLivre(base: string, ocupados: Set<string>): string {
  const limpo = base.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "produto";
  if (!ocupados.has(limpo)) return limpo;
  for (let n = 2; n < 500; n += 1) {
    const tentativa = `${limpo}-${n}`;
    if (!ocupados.has(tentativa)) return tentativa;
  }
  return `${limpo}-${randomUUID().slice(0, 8)}`;
}

/**
 * Cria uma copia de um produto para servir de ponto de partida a uma variacao
 * (a mesma TV noutro tamanho, o mesmo suporte noutra cor).
 *
 * O que NAO e copiado, de proposito:
 *
 *   * `rating`, `review_count` e `sold_count` — sao a reputacao do anuncio
 *     original. Herda-las daria a um produto recem-criado avaliacoes que ele
 *     nunca recebeu, o que e inventar prova social.
 *   * `is_featured` e `is_best_seller` — "mais vendido" num produto com zero
 *     venda e afirmacao falsa. O operador liga de novo se quiser.
 *   * `external_id` — e a identidade do anuncio de origem na importacao; dois
 *     produtos com o mesmo valor confundiriam qualquer reimportacao.
 *   * estoque, datas de venda e de entrada — comecam zerados.
 *
 * A copia nasce como rascunho: ela ainda precisa de foto propria e revisao
 * antes de aparecer na loja.
 */
export async function duplicateProductAction(formData: FormData) {
  const owner = await ownerOrThrow();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  let destino = "";
  try {
    const atual = await readCatalogState(true);
    const original = atual.products.find((item) => item.id === id);
    if (!original) {
      redirect("/painel/produtos?erro=Produto+nao+encontrado.");
    }

    const slugs = new Set(atual.products.map((item) => item.slug));
    const ids = new Set(atual.products.map((item) => item.id));
    const novoSlug = slugLivre(`${original.slug}-copia`, slugs);
    const novoId = slugLivre(novoSlug, ids);
    const proximoSku = buildCategorySkuChoices(atual.categories, atual.products)
      .find((escolha) => escolha.categoryId === original.category_id)?.nextSku;

    // As imagens sao copiadas de verdade no Storage antes da gravacao: se o
    // arquivo nao puder ser duplicado, a linha entra sem storage_path e a
    // duplicacao segue em vez de falhar inteira.
    const imagens = await Promise.all((original.product_images ?? []).map(async (imagem, indice) => {
      const copia = await copyCatalogImage(imagem.storage_path, imagem.src, novoId);
      return {
        id: randomUUID(),
        product_id: novoId,
        src: copia.src,
        storage_path: copia.storagePath,
        alt: imagem.alt,
        sort_order: imagem.sort_order,
        is_primary: imagem.is_primary || indice === 0,
      };
    }));

    // Variacoes ganham id e SKU proprios: o indice unico de sku recusaria a
    // copia, e id repetido faria as duas fichas apontarem para a mesma linha.
    const skusUsados = new Set([
      ...atual.products.map((item) => item.sku.toUpperCase()),
      ...atual.products.flatMap((item) => (item.product_variants ?? []).map((linha) => linha.sku.toUpperCase())),
    ]);
    const baseSku = proximoSku ?? `${original.sku}-COPIA`;
    const variacoes = (original.product_variants ?? []).map((linha, indice) => {
      let sku = `${baseSku}-${linha.label.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12) || indice + 1}`;
      for (let n = 2; skusUsados.has(sku.toUpperCase()); n += 1) sku = `${baseSku}-${indice + 1}-${n}`;
      skusUsados.add(sku.toUpperCase());
      return { ...linha, id: randomUUID(), product_id: novoId, sku, stock: 0 };
    });

    const agora = new Date().toISOString();
    const copia: AdminProductRow = {
      ...original,
      id: novoId,
      slug: novoSlug,
      product_variants: variacoes,
      name: `${original.name} (cópia)`,
      sku: proximoSku ?? `${original.sku}-COPIA`,
      external_id: null,
      stock: 0,
      status: "draft",
      rating: null,
      review_count: null,
      sold_count: null,
      is_featured: false,
      is_best_seller: false,
      published_at: null,
      last_stock_entry_at: null,
      last_sale_at: null,
      created_at: agora,
      updated_at: agora,
      product_images: imagens,
    };

    await mutateCatalogState((state) => {
      // Reconfere na hora da gravacao: entre a leitura e agora outra sessao
      // pode ter criado um produto com este mesmo endereco.
      if (state.products.some((item) => item.id === copia.id || item.slug === copia.slug)) {
        copia.slug = slugLivre(`${copia.slug}-${randomUUID().slice(0, 4)}`, new Set(state.products.map((item) => item.slug)));
        copia.id = copia.slug;
        for (const imagem of copia.product_images ?? []) imagem.product_id = copia.id;
        for (const linha of copia.product_variants ?? []) linha.product_id = copia.id;
      }
      state.products.unshift(copia);
      audit(state, owner.id, "product.duplicated", "product", copia.id, { id: original.id, name: original.name, sku: original.sku }, { id: copia.id, name: copia.name, sku: copia.sku });
    });

    refreshCatalog();
    revalidatePath("/painel/produtos");
    destino = `/painel/produtos/${encodeURIComponent(copia.id)}?duplicado=1`;
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    console.error("Falha ao duplicar produto:", error);
    destino = "/painel/produtos?erro=Nao+foi+possivel+duplicar+o+produto+agora.";
  }
  // Fora do try: redirect() funciona lancando, e dentro do bloco o proprio
  // catch o transformaria em mensagem de erro.
  redirect(destino);
}

/**
 * Exclui um produto em definitivo — fotos, variacoes e cadastro.
 *
 * Recusa quando o produto ja tem historico. inventory_movements.product_id tem
 * ON DELETE CASCADE: excluir apagaria junto cada entrada e cada baixa de
 * estoque desse produto, e os relatorios passariam a mentir sobre o passado.
 * Nesse caso o certo e arquivar, que tira da loja e da lista sem destruir nada.
 *
 * Pedido antigo (o pedido guarda nome, SKU e preco no proprio registro) nao
 * impede a exclusao: ele nao perde informacao nenhuma.
 */
export async function deleteProductAction(formData: FormData) {
  const owner = await ownerOrThrow();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  let destino = "/painel/produtos";
  try {
    const atual = await readCatalogState(true);
    const produto = atual.products.find((item) => item.id === id);
    if (!produto) {
      redirect("/painel/produtos?erro=Produto+nao+encontrado.");
    }

    const movimentos = await countProductMovements(id);
    if (movimentos > 0) {
      const recado = `“${produto.name}” tem ${movimentos} movimento(s) de estoque. Excluir apagaria esse histórico — use Arquivar, que tira da loja e da lista sem perder nada.`;
      redirect(`/painel/produtos?erro=${encodeURIComponent(recado)}`);
    }

    // Os arquivos saem do Storage antes do cadastro: depois de removida a
    // linha nao haveria mais como saber o caminho e eles ficariam orfaos.
    for (const imagem of produto.product_images ?? []) {
      if (imagem.storage_path) await deleteCatalogImage(imagem.storage_path).catch(() => undefined);
    }

    await mutateCatalogState((state) => {
      state.products = state.products.filter((item) => item.id !== id);
      delete state.operations.product_meta[id];
      // O log fica: audit_logs nao tem vinculo com products e sobrevive.
      audit(state, owner.id, "product.deleted", "product", id, { name: produto.name, sku: produto.sku, stock: produto.stock }, null);
    });

    refreshCatalog();
    revalidatePath("/painel/produtos");
    destino = `/painel/produtos?excluido=${encodeURIComponent(produto.name)}`;
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    console.error("Falha ao excluir produto:", error);
    destino = "/painel/produtos?erro=Nao+foi+possivel+excluir+o+produto+agora.";
  }
  // Fora do try: redirect() funciona lancando e o catch o converteria em erro.
  redirect(destino);
}

// ---------------------------------------------------------------------------
// Pedidos em massa: cancelar e excluir varios de uma vez
// ---------------------------------------------------------------------------

/**
 * Cancela ou exclui os pedidos marcados na lista.
 *
 * Existe porque um lancamento em lote que sai errado deixa dezenas de pedidos
 * para desfazer, e faze-lo um a um e inviavel.
 *
 * A diferenca entre as duas acoes importa:
 *
 *   * CANCELAR devolve o estoque e mantem o pedido no historico, marcado como
 *     cancelado. E o certo para venda que nao aconteceu.
 *   * EXCLUIR remove o pedido dos relatorios. Se ele estava finalizado, o
 *     estoque e devolvido ANTES de apagar — senao as unidades sumiriam do
 *     saldo sem nenhum pedido para justificar. O atendimento que o checkout
 *     criou para o pedido (copia dos dados do cliente) e apagado junto.
 *
 * Os movimentos de estoque ficam nos dois casos: inventory_movements nao tem
 * vinculo com o pedido, entao a baixa e a devolucao continuam no historico.
 */
export async function bulkOrdersAction(formData: FormData): Promise<void> {
  const owner = await ownerOrThrow();
  const ids = formData.getAll("orderIds").map((valor) => String(valor).trim()).filter(Boolean);
  const acao = String(formData.get("acao") ?? "");

  let destino = "/painel/pedidos";
  try {
    if (!ids.length) {
      redirect("/painel/pedidos?erro=Marque+pelo+menos+um+pedido.");
    }
    if (acao !== "cancelar" && acao !== "excluir") {
      redirect("/painel/pedidos?erro=Acao+invalida.");
    }

    const falhas: string[] = [];
    const cancelados: Array<{ id: string; number: string }> = [];
    const encontrados: Array<{ id: string; number: string }> = [];

    for (const id of ids) {
      try {
        // Leitura fresca a cada pedido: o anterior acabou de mexer no estoque.
        const estado = await readCatalogState(true);
        const pedido = estado.operations.orders.find((item) => item.id === id);
        if (!pedido) continue;
        encontrados.push({ id: pedido.id, number: pedido.number });
        // Excluir um pedido finalizado sem devolver o estoque antes deixaria o
        // saldo menor sem nenhum registro explicando por quê.
        if (pedido.status !== "cancelled") {
          await cancelSalesOrder(estado, id, owner.id);
          cancelados.push({ id: pedido.id, number: pedido.number });
        }
      } catch (error) {
        falhas.push(error instanceof OrderOperationError ? error.message : `Pedido ${id} falhou.`);
      }
    }

    let excluidos = 0;
    if (acao === "excluir") {
      excluidos = await deleteOrderRecords(ids);
      // O atendimento criado pelo checkout é cópia do pedido (nome, telefone,
      // observação) e sai junto; um atendimento só vinculado ao pedido fica,
      // fechado como perdido. Best-effort, uma consulta para o lote inteiro.
      // Entram também os que já estavam cancelados.
      const atendimentos = await discardLeadsOfDeletedOrders(encontrados, owner.id);
      await mutateCatalogState((state) => {
        audit(state, owner.id, "order.bulk_deleted", "order", ids[0], { ids, total: ids.length, ...(atendimentos ? { atendimentos } : {}) }, null);
      });
    } else {
      // Atendimentos dos pedidos cancelados fecham como perdidos (best-effort).
      await closeLeadsOfOrders(cancelados, { stage: "lost", note: "Pedido cancelado" }, owner.id);
    }

    refreshCatalog();
    revalidatePath("/painel/pedidos");
    revalidatePath("/painel/financeiro");
    revalidatePath("/painel/historico");
    revalidatePath("/painel/atendimento");
    revalidatePath("/painel/trafego");
    revalidatePath("/painel/clientes");

    const resumo = acao === "excluir"
      ? `${excluidos} pedido(s) excluído(s)${cancelados.length ? ` · estoque devolvido de ${cancelados.length}` : ""}.`
      : `${cancelados.length} pedido(s) cancelado(s) e estoque devolvido.`;
    destino = falhas.length
      ? `/painel/pedidos?erro=${encodeURIComponent(`${resumo} ${falhas.length} com problema: ${falhas[0]}`)}`
      : `/painel/pedidos?feito=${encodeURIComponent(resumo)}`;
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    console.error("Falha na acao em massa de pedidos:", error);
    destino = "/painel/pedidos?erro=Nao+foi+possivel+concluir+a+acao+agora.";
  }
  // Fora do try: redirect() funciona lancando e o catch o viraria erro.
  redirect(destino);
}

// ---------------------------------------------------------------------------
// Envio de fotos direto do navegador para o Storage
// ---------------------------------------------------------------------------

const TIPOS_DE_IMAGEM: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const TAMANHO_MAXIMO = 4 * 1024 * 1024;

const arquivoParaEnviar = z.object({
  type: z.string().trim().max(80),
  size: z.number().int().positive(),
});

export interface UploadTarget {
  storagePath: string;
  signedUrl: string;
  src: string;
}

/**
 * Prepara o envio das fotos: devolve uma URL assinada por arquivo.
 *
 * O arquivo vai do navegador DIRETO para o Storage. Mandar pela Server Action
 * batia no teto de corpo de requisicao da hospedagem — medido em producao como
 * HTTP 413 com um lote de 8 MB — e foto de celular estoura isso sozinha.
 */
export async function createImageUploadTargetsAction(productId: unknown, arquivos: unknown): Promise<{ ok: boolean; message?: string; targets?: UploadTarget[] }> {
  await ownerOrThrow();
  const parsedId = z.string().trim().min(1).max(200).safeParse(productId);
  const parsed = z.array(arquivoParaEnviar).min(1).max(12).safeParse(arquivos);
  if (!parsedId.success || !parsed.success) return { ok: false, message: "Revise as fotos selecionadas." };

  if (parsed.data.some((arquivo) => !TIPOS_DE_IMAGEM[arquivo.type])) return { ok: false, message: "Use apenas JPG, PNG ou WebP." };
  if (parsed.data.some((arquivo) => arquivo.size > TAMANHO_MAXIMO)) return { ok: false, message: "Cada imagem deve ter no máximo 4 MB." };

  const estado = await readCatalogState();
  if (!estado.products.some((product) => product.id === parsedId.data)) return { ok: false, message: "Produto não encontrado." };

  try {
    const targets = await Promise.all(
      parsed.data.map((arquivo) => createImageUploadTarget(parsedId.data, TIPOS_DE_IMAGEM[arquivo.type])),
    );
    return { ok: true, targets };
  } catch (error) {
    console.error("Falha ao preparar envio de imagens:", error);
    return { ok: false, message: "Não foi possível preparar o envio agora. Tente novamente." };
  }
}

/**
 * Registra no catalogo as fotos que ja chegaram ao Storage.
 *
 * Cada caminho e conferido no Storage antes de entrar: um envio interrompido
 * no meio gravaria uma imagem inexistente, e a vitrine mostraria quadro
 * quebrado.
 */
export async function registerProductImagesAction(productId: unknown, caminhos: unknown, alt: unknown): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const parsedId = z.string().trim().min(1).max(200).safeParse(productId);
  const parsed = z.array(z.string().trim().min(1).max(400)).min(1).max(12).safeParse(caminhos);
  if (!parsedId.success || !parsed.success) return { message: "Nenhuma foto para registrar." };

  const rotulo = String(alt ?? "").trim() || "Foto do produto";
  try {
    const presentes: string[] = [];
    for (const caminho of parsed.data) {
      if (await imageExistsInStorage(caminho)) presentes.push(caminho);
    }
    if (!presentes.length) return { message: "As fotos não chegaram ao servidor. Tente enviar novamente." };

    await mutateCatalogState((state) => {
      const product = state.products.find((item) => item.id === parsedId.data);
      if (!product) throw new Error("Produto não encontrado.");
      const images = product.product_images ?? [];
      presentes.forEach((caminho, indice) => {
        images.push({
          id: randomUUID(), product_id: parsedId.data,
          src: publicImageUrl(caminho),
          storage_path: caminho,
          alt: `${rotulo}${presentes.length > 1 ? ` ${indice + 1}` : ""}`,
          sort_order: images.length,
          is_primary: images.length === 0,
        });
      });
      product.product_images = images;
      product.updated_at = new Date().toISOString();
      audit(state, owner.id, "product.images_uploaded", "product", parsedId.data, null, { paths: presentes, count: presentes.length });
    });

    refreshCatalog();
    const faltaram = parsed.data.length - presentes.length;
    return {
      ok: true,
      message: faltaram
        ? `${presentes.length} foto(s) registrada(s). ${faltaram} não chegaram e precisam ser reenviadas.`
        : `${presentes.length} ${presentes.length === 1 ? "foto enviada" : "fotos enviadas"} com sucesso.`,
    };
  } catch (error) {
    console.error("Falha ao registrar imagens:", error);
    return catalogStorageError(error);
  }
}

/** Mesma URL publica que o Storage devolve, montada sem outra ida ao servidor. */
function publicImageUrl(storagePath: string): string {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
  return `${base}/storage/v1/object/public/ecommerce-products/${storagePath}`;
}

// ── Venda para lojistas (só a conta principal) ─────────────────────────────

/**
 * Desconto geral e condições da venda para lojistas. A validação é a mesma que
 * o formulário roda antes de enviar (lib/admin/lojistas.ts); aqui ela segura
 * form adulterado. Nada disso chega à loja: mora no JSONB privado.
 */
export async function salvarVendaLojistasAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await contaPrincipalOrThrow();
  const desconto = lerDescontoDigitado(String(formData.get("descontoPercent") ?? ""));
  if (desconto === null) return { message: `O desconto precisa ser um número de 0 a ${DESCONTO_LOJISTA_MAXIMO}, como 10 ou 12,5.`, errors: { descontoPercent: ["Desconto inválido."] } };
  // O navegador envia a quebra de linha da textarea como \r\n; na tela ela
  // conta 1 caractere. Grava com \n para o limite e a comparação baterem.
  const condicoes = String(formData.get("condicoes") ?? "").replace(/\r\n?/g, "\n").trim();
  if (condicoes.length > CONDICOES_LOJISTA_MAXIMO) return { message: `As condições podem ter no máximo ${CONDICOES_LOJISTA_MAXIMO} caracteres.`, errors: { condicoes: ["Texto longo demais."] } };
  const mostrarPrecoSite = formData.get("mostrarPrecoSite") === "on";
  // A mensagem diz o que mudou de fato: salvar só as condições não pode
  // anunciar que o desconto e os preços mudaram.
  const mudancas: string[] = [];
  try {
    // mutateCatalogState regrava o catálogo inteiro: sem mudança, nem chama.
    const atual = (await readCatalogState(true)).operations.lojistas;
    if (atual.descontoPercent === desconto && atual.condicoes === condicoes && atual.mostrarPrecoSite === mostrarPrecoSite) return { ok: true, message: "Nada mudou." };
    await mutateCatalogState((state) => {
      const antes = state.operations.lojistas;
      if (antes.descontoPercent !== desconto) mudancas.push(`Desconto de ${formatarDesconto(desconto)} salvo; os preços do catálogo abaixo já mudaram.`);
      if (antes.condicoes !== condicoes) mudancas.push(condicoes ? "Condições salvas." : "Condições tiradas do catálogo.");
      if (antes.mostrarPrecoSite !== mostrarPrecoSite) mudancas.push(mostrarPrecoSite ? "O catálogo passa a mostrar o preço do site." : "O catálogo deixa de mostrar o preço do site.");
      if (!mudancas.length) return;
      state.operations.lojistas = { ...antes, descontoPercent: desconto, condicoes, mostrarPrecoSite };
      audit(state, owner.id, "lojistas.config.updated", "lojistas", "config",
        { descontoPercent: antes.descontoPercent, condicoes: antes.condicoes, mostrarPrecoSite: antes.mostrarPrecoSite },
        { descontoPercent: desconto, condicoes, mostrarPrecoSite });
    });
  } catch (error) {
    console.error("Venda para lojistas: falha ao salvar o desconto.", error);
    return { message: "Não foi possível salvar agora. Tente de novo em instantes." };
  }
  revalidatePath("/painel/lojistas");
  return { ok: true, message: mudancas.join(" ") || "Nada mudou." };
}

/** A linha do catálogo de lojistas com esta chave, no estado dado (null: não existe mais ou ficou sem estoque). */
function linhaLojista(state: CatalogState, chave: string) {
  const categorias = new Map(state.categories.map((categoria) => [categoria.id, categoria.name]));
  const produtos = state.products.map((produto) => ({ ...produto, categories: { name: categorias.get(produto.category_id) ?? produto.category_id } }));
  return linhasParaLojistas(produtos, state.operations.lojistas).find((item) => item.chave === chave) ?? null;
}

/**
 * Preço especial de uma linha (produto, ou produto::opção). Vazio tira o
 * especial e a linha volta ao desconto geral. O preço à vista usado na
 * conferência vem do catálogo, lido agora, nunca do formulário.
 */
export async function salvarPrecoLojistaAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await contaPrincipalOrThrow();
  const chave = String(formData.get("chave") ?? "").trim();
  if (!chave || chave.length > 250) return { message: "Produto inválido. Recarregue a página." };
  // "Tirar" chega como acao=tirar: vale como preço vazio.
  const texto = formData.get("acao") === "tirar" ? "" : String(formData.get("preco") ?? "");
  const naoEncontrado: ActionState = { message: "Produto não encontrado, sem estoque ou não publicado. Recarregue a página." };
  let resultado: ActionState = naoEncontrado;
  try {
    // Valida contra o catálogo lido agora ANTES de gravar: preço recusado,
    // linha que sumiu ou o mesmo preço de novo não regravam o catálogo inteiro.
    const previa = linhaLojista(await readCatalogState(true), chave);
    if (!previa) return naoEncontrado;
    const conferido = validarPrecoEspecial(texto, previa.comDescontoCents);
    if (!conferido.ok) return { message: conferido.mensagem, errors: { preco: [conferido.mensagem] } };
    if (conferido.cents === previa.especialCents) return { ok: true, message: "Nada mudou." };
    await mutateCatalogState((state) => {
      // De novo dentro da gravação: o desconto ou o produto podem ter mudado
      // entre a leitura acima e agora.
      const linha = linhaLojista(state, chave);
      if (!linha) return;
      const preco = validarPrecoEspecial(texto, linha.comDescontoCents);
      if (!preco.ok) { resultado = { message: preco.mensagem, errors: { preco: [preco.mensagem] } }; return; }
      const antes = state.operations.lojistas.precos[chave] ?? null;
      const precos = { ...state.operations.lojistas.precos };
      if (preco.cents === null) delete precos[chave]; else precos[chave] = preco.cents;
      state.operations.lojistas = { ...state.operations.lojistas, precos };
      const rotulo = linha.opcao ? `${linha.nome} · ${linha.opcao}` : linha.nome;
      audit(state, owner.id, preco.cents === null ? "lojistas.preco.removed" : "lojistas.preco.updated", "lojistas", chave, { especialCents: antes }, { especialCents: preco.cents, produto: rotulo });
      resultado = { ok: true, message: preco.cents === null ? `${rotulo}: voltou ao desconto geral.` : `${rotulo}: preço para lojista de ${formatPrice(preco.cents)}.` };
    });
  } catch (error) {
    console.error("Venda para lojistas: falha ao salvar o preço especial.", error);
    return { message: "Não foi possível salvar agora. Tente de novo em instantes." };
  }
  if (resultado.ok) revalidatePath("/painel/lojistas");
  return resultado;
}
