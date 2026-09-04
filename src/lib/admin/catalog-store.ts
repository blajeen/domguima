import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "./config";
import { defaultStoreSettings, initialCategories, initialProducts } from "./defaults";
import type { AdminCategoryRow, AdminOperationsState, AdminProductImage, AdminProductRow, SalesOrderRecord, StoreSettings } from "./types";

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

/**
 * @param fresh ignora o cache de 5s e relê a origem. Obrigatório antes de
 * qualquer escrita: gravar em cima de um retrato velho apaga o que outra
 * requisição acabou de salvar.
 */
export async function readCatalogState(fresh = false): Promise<CatalogState> {
  if (hasSupabaseConfig()) {
    if (fresh || !remoteStatePromise || Date.now() >= remoteStateExpiresAt) {
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
    // `settings` guarda apenas a configuracao pequena e mutavel (vendedores e
    // product_meta). Pedidos NAO vao mais aqui: eles moram em sales_orders,
    // gravados por INSERT. Mandar a lista junto faria o replace competir com
    // o livro-razao e reintroduzir a perda de pedido concorrente.
    const operationsSemPedidos = { sellers: state.operations.sellers, product_meta: state.operations.product_meta };
    const persistedState = {
      ...state,
      settings: { ...state.settings, __operations: operationsSemPedidos },
    };
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

/**
 * Fila de mutações do processo.
 *
 * `mutateCatalogState` faz ler → alterar → gravar o estado inteiro. Sem
 * serialização, duas chamadas simultâneas leem o mesmo retrato e a última a
 * gravar apaga a alteração da primeira — pedidos somem e a numeração repete.
 * Encadear as mutações garante que cada uma leia o resultado da anterior.
 *
 * Limite conhecido: isso protege dentro de UMA instância. Em serverless com
 * várias instâncias simultâneas a corrida ainda existe, e a solução definitiva
 * é atomicidade no banco (sequência para o número do pedido e inserção
 * append-only em vez de substituir o estado inteiro).
 */
let mutationQueue: Promise<unknown> = Promise.resolve();

export function mutateCatalogState(change: (state: CatalogState) => void | Promise<void>): Promise<CatalogState> {
  const run = async (): Promise<CatalogState> => {
    // Leitura fresca: nunca partir do cache para escrever.
    const state = structuredClone(await readCatalogState(true));
    await change(state);
    state.catalogEnabled = true;
    state.settings.catalogEnabled = true;
    await writeCatalogState(state);
    return state;
  };

  // A fila segue viva mesmo se uma mutação falhar.
  const result = mutationQueue.then(run, run);
  mutationQueue = result.catch(() => undefined);
  return result;
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
  // `sep` em vez de "\\" fixo: com a barra do Windows cravada, em Linux
  // (produção/CI) a condição barrava até caminho legítimo dentro de public/.
  if (!absolute.startsWith(`${publicRoot}${sep}`) && absolute !== publicRoot) throw new Error("Caminho de imagem invalido.");
  await unlink(absolute).catch(() => undefined);
}

async function readSupabaseCatalogState(): Promise<CatalogState> {
  const supabase = createSupabaseAdminClient();
  const [settingsResult, categoriesResult, productsResult, imagesResult, movementsResult, auditResult, ordersResult] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", "store").maybeSingle(),
    supabase.from("categories").select("*").order("sort_order", { ascending: true }),
    supabase.from("products").select("*").order("updated_at", { ascending: false }),
    supabase.from("product_images").select("*").order("sort_order", { ascending: true }),
    supabase.from("inventory_movements").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1_000),
    // Pedidos agora tem tabela propria. O limite aqui e so da leitura: como
    // nada mais reescreve a tabela inteira, o que passa dele continua guardado
    // no banco em vez de ser apagado. Folgado de proposito — os relatorios
    // financeiros somam esta lista, e um teto apertado daria numero errado.
    supabase.from("sales_orders").select("*").order("created_at", { ascending: false }).limit(5_000),
  ]);
  const firstError = [settingsResult, categoriesResult, productsResult, imagesResult, movementsResult, auditResult, ordersResult].find((result) => result.error)?.error;
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

  // Vendedores e product_meta continuam no JSONB (config pequena e mutavel).
  // Os pedidos vem da tabela propria — nunca mais do JSONB.
  const operations = normalizeOperations(__operations);
  operations.orders = (ordersResult.data ?? []) as SalesOrderRecord[];

  return {
    version: 2,
    catalogEnabled: Boolean(settingsRow?.catalog_enabled),
    products,
    categories,
    settings: { ...defaultStoreSettings, ...publicSettings },
    operations,
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

// ===========================================================================
// LIVRO-RAZAO
// ===========================================================================
//
// Pedidos, movimentos de estoque e auditoria so crescem. Ao contrario do
// catalogo, eles NUNCA passam por `replace_catalog_state` — cada operacao e um
// INSERT/UPDATE direcionado, numa unica transacao no banco.
//
// Era a substituicao do estado inteiro que fazia pedido simultaneo sumir (duas
// gravacoes liam o mesmo retrato e a ultima apagava a primeira) e que truncava
// o historico no teto de leitura do app a cada salvamento.
//
// Fora do Supabase (desenvolvimento em arquivo) o mesmo contrato e cumprido
// pela fila de mutacoes, que ja serializa tudo dentro do processo.

/** Marcador substituido pelo numero do pedido, que so existe dentro da transacao. */
const NUMERO_DO_PEDIDO = "{{number}}";

export interface LedgerMovementDraft {
  id?: string;
  product_id: string;
  /** Negativo baixa estoque, positivo devolve. */
  quantity_delta: number;
  reason: string;
  /** Pode conter o marcador `{{number}}`, trocado pelo numero real do pedido. */
  note?: string | null;
  commission_percent?: number;
  commission_cents?: number;
  actor_id: string;
  batch_id?: string | null;
}

export interface LedgerAuditDraft {
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_data: unknown;
  after_data: Record<string, unknown>;
}

export type OrderDraft = Omit<SalesOrderRecord, "number">;

/** Estoque insuficiente ou produto inexistente, detectado dentro da transacao. */
export class LedgerStockError extends Error {
  constructor(readonly kind: "insufficient" | "missing", readonly productId: string) {
    super(kind === "insufficient" ? `Estoque insuficiente para ${productId}.` : `Produto ${productId} nao encontrado.`);
    this.name = "LedgerStockError";
  }
}

export interface CreateOrderResult {
  order: SalesOrderRecord;
  /** true quando o mesmo request_id ja tinha pedido: nada foi gravado de novo. */
  alreadyExisted: boolean;
}

export interface UpdateOrderResult {
  order: SalesOrderRecord | null;
  found: boolean;
  /** false quando o status atual nao era o esperado (ex.: confirmar duas vezes). */
  applied: boolean;
}

/**
 * Cria o pedido, baixa o estoque, registra os movimentos e a auditoria — tudo
 * junto ou nada. O numero vem do banco: dois pedidos simultaneos nunca recebem
 * o mesmo.
 */
export async function createOrderRecord(
  draft: OrderDraft,
  movements: LedgerMovementDraft[] = [],
  audit?: LedgerAuditDraft,
): Promise<CreateOrderResult> {
  const ordenados = ordenarPorProduto(movements);

  if (hasSupabaseConfig()) {
    const { data, error } = await createSupabaseAdminClient().rpc("create_sales_order_v2", {
      p_order: draft,
      p_movements: ordenados,
      p_audit: audit ?? null,
    });
    if (error) throw traduzirErroDeEstoque(error.message, "Nao foi possivel registrar o pedido");
    invalidarCacheRemoto();
    const payload = data as { already_existed: boolean; order: SalesOrderRecord };
    return { order: payload.order, alreadyExisted: Boolean(payload.already_existed) };
  }

  return mutarLivroRazaoLocal((state) => {
    const existente = draft.request_id ? state.operations.orders.find((order) => order.request_id === draft.request_id) : undefined;
    if (existente) return { order: existente, alreadyExisted: true };

    const number = proximoNumeroLocal(state, draft.created_at);
    const order: SalesOrderRecord = { ...draft, number };
    aplicarMovimentosLocais(state, ordenados, number);
    state.operations.orders.unshift(order);
    if (audit) state.auditLogs.unshift(montarAuditoria(audit, { number }));
    return { order, alreadyExisted: false };
  });
}

/**
 * Confirma ou cancela um pedido junto com o movimento de estoque
 * correspondente. `expectedStatus` trava a transicao: confirmar duas vezes o
 * mesmo pedido nao baixa o estoque duas vezes.
 */
export async function updateOrderRecord(
  orderId: string,
  expectedStatus: SalesOrderRecord["status"] | null,
  patch: Partial<Pick<SalesOrderRecord, "status" | "seller_id" | "seller_name" | "cancelled_at" | "cancelled_by">>,
  movements: LedgerMovementDraft[] = [],
  audit?: LedgerAuditDraft,
): Promise<UpdateOrderResult> {
  const ordenados = ordenarPorProduto(movements);

  if (hasSupabaseConfig()) {
    const { data, error } = await createSupabaseAdminClient().rpc("update_sales_order_status_v2", {
      p_id: orderId,
      p_expected_status: expectedStatus,
      p_patch: patch,
      p_movements: ordenados,
      p_audit: audit ?? null,
    });
    if (error) throw traduzirErroDeEstoque(error.message, "Nao foi possivel atualizar o pedido");
    invalidarCacheRemoto();
    const payload = data as { found: boolean; applied: boolean; order?: SalesOrderRecord };
    return { order: payload.order ?? null, found: Boolean(payload.found), applied: Boolean(payload.applied) };
  }

  return mutarLivroRazaoLocal((state) => {
    const order = state.operations.orders.find((item) => item.id === orderId);
    if (!order) return { order: null, found: false, applied: false };
    if (expectedStatus !== null && order.status !== expectedStatus) return { order, found: true, applied: false };

    aplicarMovimentosLocais(state, ordenados, order.number);
    Object.assign(order, patch);
    if (audit) state.auditLogs.unshift(montarAuditoria(audit, { number: order.number }));
    return { order, found: true, applied: true };
  });
}

/**
 * O estoque e travado linha a linha no banco; ordenar por produto evita que
 * dois pedidos com itens em comum travem em ordem invertida (deadlock).
 */
function ordenarPorProduto(movements: LedgerMovementDraft[]): LedgerMovementDraft[] {
  return [...movements].sort((a, b) => a.product_id.localeCompare(b.product_id));
}

/** Reconhece as excecoes que `apply_order_stock` levanta e devolve algo tratavel. */
function traduzirErroDeEstoque(message: string, prefixo: string): Error {
  const insuficiente = /ESTOQUE_INSUFICIENTE:(\S+)/.exec(message);
  if (insuficiente) return new LedgerStockError("insufficient", insuficiente[1]);
  const ausente = /PRODUTO_NAO_ENCONTRADO:(\S+)/.exec(message);
  if (ausente) return new LedgerStockError("missing", ausente[1]);
  return new Error(`${prefixo}: ${message}`);
}

function invalidarCacheRemoto() {
  remoteStatePromise = null;
  remoteStateExpiresAt = 0;
}

/** Caminho de desenvolvimento: mesma semantica, gravada no arquivo pela fila. */
async function mutarLivroRazaoLocal<T>(change: (state: CatalogState) => T): Promise<T> {
  let resultado!: T;
  await mutateCatalogState((state) => {
    resultado = change(state);
  });
  return resultado;
}

function aplicarMovimentosLocais(state: CatalogState, movements: LedgerMovementDraft[], number: string) {
  const agora = new Date().toISOString();
  for (const movement of movements) {
    const product = state.products.find((item) => item.id === movement.product_id);
    if (!product) throw new LedgerStockError("missing", movement.product_id);
    const antes = product.stock;
    const depois = antes + movement.quantity_delta;
    if (depois < 0) throw new LedgerStockError("insufficient", movement.product_id);

    product.stock = depois;
    product.updated_at = agora;
    if (movement.quantity_delta < 0) product.last_sale_at = agora;
    if (movement.quantity_delta > 0) product.last_stock_entry_at = agora;

    state.inventoryMovements.unshift({
      id: movement.id ?? randomUUID(),
      product_id: movement.product_id,
      quantity_delta: movement.quantity_delta,
      stock_before: antes,
      stock_after: depois,
      reason: movement.reason,
      note: (movement.note ?? "").replaceAll(NUMERO_DO_PEDIDO, number) || null,
      commission_percent: movement.commission_percent ?? 0,
      commission_cents: movement.commission_cents ?? 0,
      actor_id: movement.actor_id,
      created_at: agora,
      ...(movement.batch_id ? { batch_id: movement.batch_id } : {}),
    });
  }
}

function montarAuditoria(audit: LedgerAuditDraft, extra: Record<string, unknown>): AuditRecord {
  return {
    id: randomUUID(),
    actor_id: audit.actor_id,
    action: audit.action,
    entity_type: audit.entity_type,
    entity_id: audit.entity_id,
    before_data: audit.before_data,
    after_data: { ...audit.after_data, ...extra },
    created_at: new Date().toISOString(),
  };
}

/**
 * Numeracao no modo arquivo. Usa o maior sequencial ja emitido no dia (e nao a
 * contagem de pedidos) para que cancelar ou apagar um pedido nunca reemita um
 * numero que ja existiu.
 */
function proximoNumeroLocal(state: CatalogState, createdAt: string): string {
  const dia = dataEmSaoPaulo(createdAt);
  const prefixo = `DG-${dia.replaceAll("-", "")}-`;
  const ultimo = state.operations.orders.reduce((maior, order) => {
    if (!order.number?.startsWith(prefixo)) return maior;
    const sequencial = Number(order.number.slice(prefixo.length));
    return Number.isFinite(sequencial) && sequencial > maior ? sequencial : maior;
  }, 0);
  return `${prefixo}${String(ultimo + 1).padStart(3, "0")}`;
}

function dataEmSaoPaulo(value: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
