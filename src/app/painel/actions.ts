"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminSession, destroyAdminSession, ownerOrThrow, verifyAdminCredentials } from "@/lib/admin/auth";
import { createInitialState, deleteCatalogImage, mutateCatalogState, readCatalogState, uploadCatalogImage, type CatalogState } from "@/lib/admin/catalog-store";
import { applyDailySales, applyInventoryCounts, InventoryOperationError } from "@/lib/admin/inventory";
import { cancelSalesOrder, createSalesOrder, OrderOperationError } from "@/lib/admin/orders";
import type { ActionState, AdminProductRow, StoreSettings } from "@/lib/admin/types";
import { categorySchema, moneyToCents, numberFrom, productSchema } from "@/lib/admin/validation";
import { isValidCPF, onlyDigits } from "@/lib/utils/validators";

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
    quantity: z.number().int().min(1).max(10_000),
    expectedStock: z.number().int().min(0),
    unitPriceCents: z.number().int().positive().max(100_000_000),
  })).min(1).max(100),
});

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!(await verifyAdminCredentials(username, password))) return { message: "Usuario ou senha incorretos." };
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
  if (costCents !== null && costCents <= 0) return { message: "Informe um custo válido ou deixe o campo vazio." };
  if (ncm && ncm.length !== 8) return { message: "O NCM deve conter exatamente 8 dígitos." };
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

  const value = parsed.data;
  let created = false;
  try {
    const state = await readCatalogState();
    const before = state.products.find((product) => product.id === id);
    if (state.products.some((product) => product.id !== id && product.slug === value.slug)) return { message: "Ja existe um produto com este endereco (slug)." };
    if (state.products.some((product) => product.id !== id && product.sku === value.sku)) return { message: "Ja existe um produto com este SKU." };
    if (!before && value.status === "active") return { message: "Cadastre como rascunho, adicione uma foto e depois publique." };
    if (before && value.status === "active" && !before.product_images?.length) return { message: "Adicione ao menos uma foto antes de publicar o produto." };

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

    await mutateCatalogState((draft) => {
      const index = draft.products.findIndex((item) => item.id === id);
      if (index >= 0) draft.products[index] = product; else draft.products.push(product);
      if (!before && value.stock > 0) draft.inventoryMovements.unshift({ id: randomUUID(), product_id: id, quantity_delta: value.stock, stock_before: 0, stock_after: value.stock, reason: "initial_import", note: "Estoque informado no cadastro", commission_percent: 0, commission_cents: 0, actor_id: owner.id, created_at: now });
      draft.operations.product_meta[id] = { ncm, cost_cents: costCents };
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
    let created: ReturnType<typeof createSalesOrder> | null = null;
    await mutateCatalogState((state) => { created = createSalesOrder(state, parsed.data, owner.id); });
    refreshCatalog();
    revalidatePath("/painel/pedidos");
    revalidatePath("/painel/financeiro");
    return { ok: true, message: `Pedido ${created!.number} finalizado. O estoque foi atualizado.`, orderId: created!.id, orderNumber: created!.number };
  } catch (error) {
    if (error instanceof OrderOperationError) return { message: error.message };
    return catalogStorageError(error);
  }
}

export async function cancelOrderAction(formData: FormData) {
  const owner = await ownerOrThrow();
  const orderId = String(formData.get("orderId") ?? "").trim();
  if (!orderId) return;
  await mutateCatalogState((state) => { cancelSalesOrder(state, orderId, owner.id); });
  refreshCatalog();
  revalidatePath("/painel/pedidos");
  revalidatePath("/painel/financeiro");
  redirect(`/painel/pedidos?cancelado=${encodeURIComponent(orderId)}`);
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

function refreshCatalog() {
  updateTag("catalog");
  for (const path of ["/", "/painel", "/painel/produtos", "/painel/estoque", "/painel/ofertas", "/painel/configuracoes", "/painel/pedidos", "/painel/financeiro"]) revalidatePath(path);
}

function audit(state: CatalogState, actorId: string, action: string, entityType: string, entityId: string, beforeData: unknown, afterData: unknown) {
  state.auditLogs.unshift({ id: randomUUID(), actor_id: actorId, action, entity_type: entityType, entity_id: entityId, before_data: beforeData, after_data: afterData, created_at: new Date().toISOString() });
  state.auditLogs = state.auditLogs.slice(0, 1000);
}

function splitCommaList(value: FormDataEntryValue | null): string[] { return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean); }
function parseSpecifications(value: FormDataEntryValue | null) { return String(value ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [label, ...rest] = line.split(":"); return { label: label.trim(), value: rest.join(":").trim() }; }).filter((item) => item.label && item.value); }
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
