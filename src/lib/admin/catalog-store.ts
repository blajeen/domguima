import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "./config";
import { defaultStoreSettings, initialCategories, initialProducts } from "./defaults";
import type { AdminCategoryRow, AdminOperationsState, AdminProductImage, AdminProductRow, StoreSettings } from "./types";

export interface InventoryMovementRecord {
  id: string;
  product_id: string;
  quantity_delta: number;
  stock_before: number;
  stock_after: number;
  reason: string;
  note: string | null;
  commission_percent: number;
  commission_cents: number;
  actor_id: string;
  created_at: string;
  /** Idempotency key for a daily sales batch, when applicable. */
  batch_id?: string;
  products?: { name: string; sku: string };
}

export interface AuditRecord {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
}

export interface CatalogState {
  version: 1 | 2;
  catalogEnabled: boolean;
  products: AdminProductRow[];
  categories: AdminCategoryRow[];
  settings: StoreSettings;
  operations: AdminOperationsState;
  inventoryMovements: InventoryMovementRecord[];
  auditLogs: AuditRecord[];
  updatedAt: string;
}

const LOCAL_FILE = join(process.cwd(), "data", "admin-catalog.json");
const PRODUCT_BUCKET = "ecommerce-products";
let remoteStatePromise: Promise<CatalogState> | null = null;
let remoteStateExpiresAt = 0;

export function createInitialState(): CatalogState {
  return {
    version: 2,
    catalogEnabled: false,
    products: initialProducts(),
    categories: initialCategories(),
    settings: { ...defaultStoreSettings },
    operations: defaultOperationsState(),
    inventoryMovements: [],
    auditLogs: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function readCatalogState(): Promise<CatalogState> {
  if (hasSupabaseConfig()) {
    if (!remoteStatePromise || Date.now() >= remoteStateExpiresAt) {
      remoteStateExpiresAt = Date.now() + 5_000;
      remoteStatePromise = readSupabaseCatalogState();
    }
    return remoteStatePromise;
  }

  try {
    return normalizeCatalogState(JSON.parse(await readFile(LOCAL_FILE, "utf8")) as Partial<CatalogState>);
  } catch {
    return createInitialState();
  }
}

export async function writeCatalogState(state: CatalogState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  if (hasSupabaseConfig()) {
    // O RPC atual persiste `settings` como JSONB. O livro operacional fica
    // encapsulado nele para que pedidos funcionem sem uma migração destrutiva.
    const persistedState = { ...state, settings: { ...state.settings, __operations: state.operations } };
    const { error } = await createSupabaseAdminClient().rpc("replace_catalog_state", { p_state: persistedState });
    if (error) throw new Error(`Nao foi possivel salvar o catalogo no Supabase: ${error.message}`);
    remoteStateExpiresAt = Date.now() + 5_000;
    remoteStatePromise = Promise.resolve(structuredClone(state));
    return;
  }

  if (process.env.VERCEL) throw new Error("Configure o Supabase para salvar alteracoes em producao.");
  await mkdir(dirname(LOCAL_FILE), { recursive: true });
  await writeFile(LOCAL_FILE, JSON.stringify(state, null, 2), "utf8");
}

export async function mutateCatalogState(change: (state: CatalogState) => void | Promise<void>): Promise<CatalogState> {
  const state = structuredClone(await readCatalogState());
  await change(state);
  state.catalogEnabled = true;
  state.settings.catalogEnabled = true;
  await writeCatalogState(state);
  return state;
}

export async function uploadCatalogImage(file: File, productId: string): Promise<{ src: string; storagePath: string }> {
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const safeProduct = productId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const storagePath = `products/${safeProduct}/${Date.now()}-${randomUUID()}.${extension}`;

  if (hasSupabaseConfig()) {
    const storage = createSupabaseAdminClient().storage.from(PRODUCT_BUCKET);
    const { error } = await storage.upload(storagePath, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (error) throw new Error(`Nao foi possivel enviar a imagem: ${error.message}`);
    const { data } = storage.getPublicUrl(storagePath);
    return { src: data.publicUrl, storagePath };
  }

  if (process.env.VERCEL) throw new Error("Configure o Supabase para enviar imagens em producao.");
  const relative = join("uploads", safeProduct, storagePath.split("/").at(-1)!).replace(/\\/g, "/");
  const absolute = join(process.cwd(), "public", relative);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, Buffer.from(await file.arrayBuffer()));
  return { src: `/${relative}`, storagePath: relative };
}

export async function deleteCatalogImage(storagePath: string): Promise<void> {
  if (hasSupabaseConfig() && !storagePath.startsWith("/")) {
    const { error } = await createSupabaseAdminClient().storage.from(PRODUCT_BUCKET).remove([storagePath]);
    if (error) throw new Error(`Nao foi possivel remover a imagem: ${error.message}`);
    return;
  }
  const publicRoot = resolve(process.cwd(), "public");
  const absolute = resolve(publicRoot, storagePath);
  if (!absolute.startsWith(`${publicRoot}\\`) && absolute !== publicRoot) throw new Error("Caminho de imagem invalido.");
  await unlink(absolute).catch(() => undefined);
}

async function readSupabaseCatalogState(): Promise<CatalogState> {
  const supabase = createSupabaseAdminClient();
  const [settingsResult, categoriesResult, productsResult, imagesResult, movementsResult, auditResult] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", "store").maybeSingle(),
    supabase.from("categories").select("*").order("sort_order", { ascending: true }),
    supabase.from("products").select("*").order("updated_at", { ascending: false }),
    supabase.from("product_images").select("*").order("sort_order", { ascending: true }),
    supabase.from("inventory_movements").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1_000),
  ]);
  const firstError = [settingsResult, categoriesResult, productsResult, imagesResult, movementsResult, auditResult].find((result) => result.error)?.error;
  if (firstError) throw new Error(`Nao foi possivel ler o catalogo no Supabase: ${firstError.message}`);

  if (!settingsResult.data && !categoriesResult.data?.length && !productsResult.data?.length) return createInitialState();

  const categories = (categoriesResult.data ?? []) as AdminCategoryRow[];
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const imagesByProduct = new Map<string, AdminProductRow["product_images"]>();
  for (const image of (imagesResult.data ?? []) as AdminProductImage[]) {
    const images = imagesByProduct.get(image.product_id) ?? [];
    images.push(image);
    imagesByProduct.set(image.product_id, images);
  }
  const settingsRow = settingsResult.data as { catalog_enabled?: boolean; settings?: Partial<StoreSettings> & { __operations?: AdminOperationsState }; updated_at?: string } | null;
  const persistedSettings = settingsRow?.settings ?? {};
  const { __operations, ...publicSettings } = persistedSettings;
  const products = ((productsResult.data ?? []) as AdminProductRow[]).map((product) => ({
    ...product,
    product_images: imagesByProduct.get(product.id) ?? [],
    categories: { name: categoryNames.get(product.category_id) ?? product.category_id },
  }));

  return {
    version: 2,
    catalogEnabled: Boolean(settingsRow?.catalog_enabled),
    products,
    categories,
    settings: { ...defaultStoreSettings, ...publicSettings },
    operations: normalizeOperations(__operations),
    inventoryMovements: enrichMovementCommissions((movementsResult.data ?? []) as InventoryMovementRecord[], (auditResult.data ?? []) as AuditRecord[]),
    auditLogs: (auditResult.data ?? []) as AuditRecord[],
    updatedAt: settingsRow?.updated_at ?? new Date().toISOString(),
  };
}

export function defaultOperationsState(): AdminOperationsState {
  return {
    sellers: [
      { id: "dom-guima", name: "Dom Guima", active: true },
      { id: "gabriel", name: "Gabriel", active: true },
    ],
    orders: [],
    product_meta: {},
  };
}

function normalizeOperations(value?: Partial<AdminOperationsState> | null): AdminOperationsState {
  const fallback = defaultOperationsState();
  return {
    sellers: Array.isArray(value?.sellers) && value.sellers.length ? value.sellers : fallback.sellers,
    orders: Array.isArray(value?.orders) ? value.orders : [],
    product_meta: value?.product_meta && typeof value.product_meta === "object" ? value.product_meta : {},
  };
}

function normalizeCatalogState(value: Partial<CatalogState>): CatalogState {
  const fallback = createInitialState();
  return {
    ...fallback,
    ...value,
    version: 2,
    settings: { ...fallback.settings, ...(value.settings ?? {}) },
    operations: normalizeOperations(value.operations),
    products: Array.isArray(value.products) ? value.products : fallback.products,
    categories: Array.isArray(value.categories) ? value.categories : fallback.categories,
    inventoryMovements: Array.isArray(value.inventoryMovements) ? value.inventoryMovements : [],
    auditLogs: Array.isArray(value.auditLogs) ? value.auditLogs : [],
  };
}

// Compatibilidade com instalações anteriores à coluna de comissão: o RPC antigo
// ainda guarda esses dados no after_data do log de auditoria.
function enrichMovementCommissions(movements: InventoryMovementRecord[], audits: AuditRecord[]): InventoryMovementRecord[] {
  return movements.map((movement) => {
    if (Number(movement.commission_cents ?? 0) > 0) return movement;
    const match = audits.find((audit) => audit.action === "inventory.adjusted" && audit.entity_id === movement.product_id && Number((audit.after_data as { stock?: number } | null)?.stock) === Number(movement.stock_after) && Number((audit.after_data as { commissionCents?: number } | null)?.commissionCents ?? 0) > 0);
    if (!match) return movement;
    const data = match.after_data as { commissionPercent?: number; commissionCents?: number };
    return { ...movement, commission_percent: Number(data.commissionPercent ?? 0), commission_cents: Number(data.commissionCents ?? 0) };
  });
}
