import "server-only";

import { z } from "zod";
import { onlyDigits } from "@/lib/utils/validators";

/**
 * Cadastro brasileiro de codigos de barras (Bluesoft Cosmos).
 *
 * E a unica base publica que devolve NCM a partir do GTIN; as bases abertas
 * (UPCitemdb, Open Products Facts) nao cobrem eletronicos vendidos no Brasil.
 * O token e gratuito (cadastro em cosmos.bluesoft.com.br) e fica so no
 * servidor. Sem token, a busca por codigo de barras segue so pela pesquisa na
 * web — nunca falha por causa disto.
 */

const ENDPOINT = "https://api.cosmos.bluesoft.com.br/gtins/";
const TIMEOUT_MS = 4_000;

const responseSchema = z.object({
  description: z.string().nullish(),
  brand: z.object({ name: z.string().nullish() }).nullish(),
  ncm: z.object({ code: z.union([z.string(), z.number()]).nullish(), description: z.string().nullish() }).nullish(),
  gross_weight: z.number().nullish(),
  net_weight: z.number().nullish(),
});

export interface CosmosProduct {
  description: string;
  brand: string;
  ncm: string;
  ncmDescription: string;
  /** Peso bruto em gramas, quando o cadastro informa um valor plausivel. */
  weightGrams: number | null;
}

export type CosmosLookup =
  | { status: "found"; product: CosmosProduct }
  | { status: "not_configured" | "not_found" | "limit" | "unauthorized" | "error" };

export function hasCosmosConfig(): boolean {
  return Boolean(process.env.COSMOS_TOKEN?.trim());
}

export async function lookupCosmos(gtin: string): Promise<CosmosLookup> {
  const token = process.env.COSMOS_TOKEN?.trim();
  if (!token) return { status: "not_configured" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${ENDPOINT}${encodeURIComponent(gtin)}.json`, {
      headers: { "X-Cosmos-Token": token, "User-Agent": "Cosmos-API-Request", Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status === 404) return { status: "not_found" };
    if (response.status === 401 || response.status === 403) return { status: "unauthorized" };
    if (response.status === 429) return { status: "limit" };
    if (!response.ok) return { status: "error" };

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) return { status: "error" };
    const data = parsed.data;
    const description = data.description?.trim() ?? "";
    if (!description) return { status: "not_found" };
    const ncm = onlyDigits(String(data.ncm?.code ?? ""));
    const weight = data.gross_weight ?? data.net_weight ?? null;
    return {
      status: "found",
      product: {
        description,
        brand: data.brand?.name?.trim() ?? "",
        ncm: ncm.length === 8 ? ncm : "",
        ncmDescription: data.ncm?.description?.trim() ?? "",
        // O Cosmos informa em gramas (1 kg = 1000). Fora da faixa e dado sujo.
        weightGrams: weight && weight > 0 && weight < 500_000 ? Math.round(weight) : null,
      },
    };
  } catch {
    return { status: "error" };
  } finally {
    clearTimeout(timeout);
  }
}
