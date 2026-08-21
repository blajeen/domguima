import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { del, list, put } from "@vercel/blob";
import { adminConfig, hasDurableStorage } from "./config";
import { defaultStoreSettings, initialCategories, initialProducts } from "./defaults";
import type { AdminCategoryRow, AdminProductRow, StoreSettings } from "./types";

export interface InventoryMovementRecord {
  id: string;
  product_id: string;
  quantity_delta: number;
  stock_before: number;
  stock_after: number;
  reason: string;
  note: string | null;
  actor_id: string;
  created_at: string;
  products?: { name: string; sku: string };
}

export interface AuditRecord { id: string; actor_id: string; action: string; entity_type: string; entity_id: string; before_data: unknown; after_data: unknown; created_at: string; }

export interface CatalogState {
  version: 1;
  catalogEnabled: boolean;
  products: AdminProductRow[];
  categories: AdminCategoryRow[];
  settings: StoreSettings;
  inventoryMovements: InventoryMovementRecord[];
  auditLogs: AuditRecord[];
  updatedAt: string;
}

const LOCAL_FILE = join(process.cwd(), "data", "admin-catalog.json");
const BLOB_PREFIX = "domguima/state/catalog-";
let remoteStatePromise: Promise<CatalogState> | null = null;
let remoteStateExpiresAt = 0;

export function createInitialState(): CatalogState {
  return { version: 1, catalogEnabled: false, products: initialProducts(), categories: initialCategories(), settings: { ...defaultStoreSettings }, inventoryMovements: [], auditLogs: [], updatedAt: new Date().toISOString() };
}

export async function readCatalogState(options: { requireStorage?: boolean } = {}): Promise<CatalogState> {
  if (hasDurableStorage()) {
    if (options.requireStorage) return readRemoteCatalogState();
    if (!remoteStatePromise || Date.now() >= remoteStateExpiresAt) {
      remoteStateExpiresAt = Date.now() + 60_000;
      remoteStatePromise = readRemoteCatalogState().catch((error) => {
        console.error("Falha ao ler Vercel Blob:", error);
        return createInitialState();
      });
    }
    return remoteStatePromise;
  }
  try { return JSON.parse(await readFile(LOCAL_FILE, "utf8")) as CatalogState; }
  catch { return createInitialState(); }
}

export async function writeCatalogState(state: CatalogState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  if (hasDurableStorage()) {
    await put(`${BLOB_PREFIX}${Date.now()}-${randomUUID()}.txt`, encrypt(JSON.stringify(state)), {
      access: "public", addRandomSuffix: false, contentType: "text/plain", cacheControlMaxAge: 60,
    });
    remoteStateExpiresAt = Date.now() + 60_000;
    remoteStatePromise = Promise.resolve(structuredClone(state));
    return;
  }
  if (process.env.VERCEL) throw new Error("Conecte um Vercel Blob ao projeto para salvar alteracoes.");
  await mkdir(dirname(LOCAL_FILE), { recursive: true });
  await writeFile(LOCAL_FILE, JSON.stringify(state, null, 2), "utf8");
}

export async function mutateCatalogState(change: (state: CatalogState) => void | Promise<void>): Promise<CatalogState> {
  // Never mutate an initial fallback after a remote read failure. Doing so
  // could replace a real catalog with defaults when the storage comes back.
  const state = structuredClone(await readCatalogState({ requireStorage: true }));
  await change(state);
  state.catalogEnabled = true;
  state.settings.catalogEnabled = true;
  await writeCatalogState(state);
  return state;
}

async function readRemoteCatalogState(): Promise<CatalogState> {
  const result = await list({ prefix: BLOB_PREFIX, limit: 100 });
  const latest = [...result.blobs].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
  if (!latest) return createInitialState();
  const response = await fetch(latest.url);
  if (!response.ok) throw new Error("Nao foi possivel ler o catalogo persistente.");
  return JSON.parse(decrypt(await response.text())) as CatalogState;
}

export async function uploadCatalogImage(file: File, productId: string): Promise<{ src: string; storagePath: string }> {
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const safeProduct = productId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const name = `${Date.now()}-${randomUUID()}.${extension}`;
  if (hasDurableStorage()) {
    const blob = await put(`domguima/products/${safeProduct}/${name}`, file, { access: "public", addRandomSuffix: false, contentType: file.type });
    return { src: blob.url, storagePath: blob.url };
  }
  if (process.env.VERCEL) throw new Error("Conecte um Vercel Blob ao projeto para enviar imagens.");
  const relative = join("uploads", safeProduct, name).replace(/\\/g, "/");
  const absolute = join(process.cwd(), "public", relative);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, Buffer.from(await file.arrayBuffer()));
  return { src: `/${relative}`, storagePath: relative };
}

export async function deleteCatalogImage(storagePath: string): Promise<void> {
  if (storagePath.startsWith("https://")) { await del(storagePath); return; }
  const publicRoot = resolve(process.cwd(), "public");
  const absolute = resolve(publicRoot, storagePath);
  if (!absolute.startsWith(`${publicRoot}\\`) && absolute !== publicRoot) throw new Error("Caminho de imagem invalido.");
  await unlink(absolute).catch(() => undefined);
}

function encryptionKey() {
  if (!adminConfig.sessionSecret) throw new Error("ADMIN_SESSION_SECRET nao configurado.");
  return createHash("sha256").update(adminConfig.sessionSecret).digest();
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decrypt(value: string): string {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Catalogo persistente invalido.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
