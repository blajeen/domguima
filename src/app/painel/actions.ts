"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminSession, destroyAdminSession, ownerOrThrow, verifyAdminCredentials } from "@/lib/admin/auth";
import { copyCatalogImage, countProductMovements, createInitialState, deleteCatalogImage, deleteOrderRecords, mutateCatalogState, readCatalogState, uploadCatalogImage, type CatalogState } from "@/lib/admin/catalog-store";
import { applyDailySales, applyInventoryCounts, InventoryOperationError } from "@/lib/admin/inventory";
import { cancelSalesOrder, confirmPendingSalesOrder, createChannelSalesOrder, createSalesOrder, OrderOperationError } from "@/lib/admin/orders";
import { buildCategorySkuChoices } from "@/lib/admin/sku";
import type { ActionState, AdminProductRow, AdminProductVariant, StoreSettings } from "@/lib/admin/types";
import { categorySchema, moneyToCents, numberFrom, productSchema } from "@/lib/admin/validation";
import { isValidCPF, isValidGTIN, onlyDigits } from "@/lib/utils/validators";

const inventoryCountInput = z.object({
  productId: z.string().trim().min(1).max(200),
  expectedStock: z.number().int().min(0),
  stock: z.number().int().min(0).max(1_000_000),
  expectedPriceCents: z.number().int().positive().optional(),
  priceCents: z.number().int().positive().optional(),
  oldPriceCents: z.number().int().positive().nullable().optional(),
  cardInstallment: z.object({ count: z.number().int().min(2).max(24), value: z.number().int().positive() }).nullable().optional(),
});

const dailySaleInput = z.object({
  productId: z.string().trim().min(1).max(200),
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

  if (!(await verifyAdminCredentials(username, password))) {
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
  await createAdminSession();
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

export async function uploadProductImagesAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const productId = String(formData.get("productId") ?? "").trim();
  const files = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!files.length) return { message: "Escolha pelo menos uma imagem." };
  if (files.length > 12) return { message: "Envie no máximo 12 fotos por vez." };
  if (files.some((file) => !allowedTypes.has(file.type))) return { message: "Use apenas JPG, PNG ou WebP." };
  if (files.some((file) => file.size > 4 * 1024 * 1024)) return { message: "Cada imagem deve ter no máximo 4 MB." };
  if (files.reduce((total, file) => total + file.size, 0) > 40 * 1024 * 1024) return { message: "O lote deve ter no máximo 40 MB. Comprima as imagens e tente novamente." };
  try {
    if (!(await readCatalogState()).products.some((product) => product.id === productId)) return { message: "Produto não encontrado." };
    const uploaded: Array<{ src: string; storagePath: string }> = [];
    try {
      for (const file of files) uploaded.push(await uploadCatalogImage(file, productId));
      await mutateCatalogState((state) => {
        const product = state.products.find((item) => item.id === productId);
        if (!product) throw new Error("Produto não encontrado.");
        const images = product.product_images ?? [];
        const alt = String(formData.get("alt") || "Foto do produto").trim() || "Foto do produto";
        uploaded.forEach((image, index) => images.push({ id: randomUUID(), product_id: productId, src: image.src, storage_path: image.storagePath, alt: `${alt}${uploaded.length > 1 ? ` ${index + 1}` : ""}`, sort_order: images.length, is_primary: images.length === 0 }));
        product.product_images = images;
        product.updated_at = new Date().toISOString();
        audit(state, owner.id, "product.images_uploaded", "product", productId, null, { paths: uploaded.map((image) => image.storagePath), count: uploaded.length });
      });
    } catch (error) {
      await Promise.all(uploaded.map((image) => deleteCatalogImage(image.storagePath).catch(() => undefined)));
      throw error;
    }
    refreshCatalog();
    return { ok: true, message: `${files.length} ${files.length === 1 ? "foto enviada" : "fotos enviadas"} com sucesso.` };
  } catch (error) {
    return catalogStorageError(error);
  }
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
  try {
    // Pedido, baixa de estoque e auditoria vao numa transacao so, direto na
    // tabela — sem passar pelo salvamento do catalogo inteiro.
    const created = await createSalesOrder(await readCatalogState(true), parsed.data, owner.id);
    refreshCatalog();
    revalidatePath("/painel/pedidos");
    revalidatePath("/painel/financeiro");
    return { ok: true, message: `Pedido ${created.number} finalizado. O estoque foi atualizado.`, orderId: created.id, orderNumber: created.number };
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
    await confirmPendingSalesOrder(await readCatalogState(true), orderId, sellerId, owner.id);
    refreshCatalog();
    revalidatePath("/painel/pedidos");
    revalidatePath("/painel/financeiro");
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
    await cancelSalesOrder(await readCatalogState(true), orderId, owner.id);
    refreshCatalog();
    revalidatePath("/painel/pedidos");
    revalidatePath("/painel/financeiro");
    destino = `/painel/pedidos?cancelado=${encodeURIComponent(orderId)}`;
  } catch (error) {
    const mensagem = error instanceof OrderOperationError ? error.message : "Não foi possível cancelar o pedido agora.";
    destino = `/painel/pedidos?erro=${encodeURIComponent(mensagem)}`;
  }
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
  const keys: Array<Exclude<keyof StoreSettings, "catalogEnabled">> = ["supportEmail", "supportHours", "cnpj", "fiscalAddress", "whatsappDisplay", "whatsappNumber", "instagramUrl", "shopeeUrl", "googleUrl", "googleRating", "googleRatingCount", "googleVerifiedAt", "pixDiscountPercent", "maxInstallments"];
  await mutateCatalogState((state) => {
    const before = { ...state.settings };
    for (const key of keys) state.settings[key] = String(formData.get(key) ?? "").trim();
    audit(state, owner.id, "settings.updated", "settings", "store", before, state.settings);
  });
  refreshCatalog();
  return { ok: true, message: "Configuracoes salvas." };
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
 * As paginas publicas de produto e categoria sao geradas estaticamente
 * (generateStaticParams). Sem revalidar o PADRAO da rota, elas ficavam
 * congeladas no momento do build: preco, estoque e variacao so chegavam na
 * loja no proximo deploy. Foi assim que um produto com 30 unidades em estoque
 * continuou anunciado como indisponivel.
 *
 * Rota com segmento dinamico exige o segundo parametro "page" — sem ele o
 * Next nao sabe se e a pagina ou o layout, e a chamada nao pega nada.
 */
function refreshCatalog() {
  updateTag("catalog");

  // Publico: tudo que lista ou detalha produto.
  revalidatePath("/produto/[slug]", "page");
  revalidatePath("/categoria/[slug]", "page");
  for (const path of ["/", "/busca", "/ofertas", "/mais-vendidos", "/sitemap.xml"]) revalidatePath(path);

  // Painel.
  for (const path of ["/painel", "/painel/produtos", "/painel/estoque", "/painel/ofertas", "/painel/configuracoes", "/painel/pedidos", "/painel/financeiro"]) revalidatePath(path);
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
 *     saldo sem nenhum pedido para justificar.
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
    const cancelados: string[] = [];

    for (const id of ids) {
      try {
        // Leitura fresca a cada pedido: o anterior acabou de mexer no estoque.
        const estado = await readCatalogState(true);
        const pedido = estado.operations.orders.find((item) => item.id === id);
        if (!pedido) continue;
        // Excluir um pedido finalizado sem devolver o estoque antes deixaria o
        // saldo menor sem nenhum registro explicando por quê.
        if (pedido.status !== "cancelled") {
          await cancelSalesOrder(estado, id, owner.id);
          cancelados.push(pedido.number);
        }
      } catch (error) {
        falhas.push(error instanceof OrderOperationError ? error.message : `Pedido ${id} falhou.`);
      }
    }

    let excluidos = 0;
    if (acao === "excluir") {
      excluidos = await deleteOrderRecords(ids);
      await mutateCatalogState((state) => {
        audit(state, owner.id, "order.bulk_deleted", "order", ids[0], { ids, total: ids.length }, null);
      });
    }

    refreshCatalog();
    revalidatePath("/painel/pedidos");
    revalidatePath("/painel/financeiro");
    revalidatePath("/painel/historico");

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
