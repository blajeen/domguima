import { z } from "zod";
import { customerKey } from "@/lib/admin/customers";
import {
  ORDER_CHANNEL_LABELS,
  ORIGIN_NOT_INFORMED_LABEL,
  TRAFFIC_SOURCE_LABELS,
  type OrderAttribution,
  type OrderChannel,
  type SalesOrderRecord,
  type TrafficSource,
} from "@/lib/admin/types";
import { ATTRIBUTION_MAX_LENGTH, cleanAttribution } from "./origem-regras";

export {
  ATTRIBUTION_KEYS,
  ATTRIBUTION_MAX_LENGTH,
  ORIGEM_COOKIE,
  ORIGEM_MAX_AGE,
  VISITANTE_COOKIE,
  VISITANTE_MAX_AGE,
  classifyTrafficSource,
  hasTrafficSignal,
  mergeAttribution,
  referrerHost,
} from "./origem-regras";

/**
 * ORIGEM DO CLIENTE (controle de trafego first-party)
 * ===================================================
 *
 * Responde "de onde veio este atendimento/pedido" sem Google Analytics, Pixel
 * ou qualquer script de terceiros: o proprio site anota a origem no navegador
 * (src/lib/store/origem-storage.ts, com as regras de origem-regras.ts) e o
 * servidor le essa anotacao quando o cliente chama no WhatsApp ou finaliza um
 * pedido.
 *
 * Isomorfico (sem "server-only"): o painel e as rotas usam daqui a validacao,
 * a classificacao e os rotulos. Codigo que roda no navegador importa so
 * origem-regras.ts, para o zod nao entrar no pacote das paginas da loja.
 */

const campo = z.string().trim().max(ATTRIBUTION_MAX_LENGTH).optional();

/**
 * Forma aceita da origem. `z.object` descarta chave desconhecida — o cookie e
 * editavel, e nada fora desta lista chega ao banco. Os campos sao os mesmos de
 * `ATTRIBUTION_KEYS` (origem-regras.ts).
 */
export const attributionSchema = z.object({
  utm_source: campo,
  utm_medium: campo,
  utm_campaign: campo,
  utm_content: campo,
  utm_term: campo,
  referrer: campo,
  landing_path: campo,
  fbclid: campo,
  gclid: campo,
  first_seen_at: campo,
  last_utm_source: campo,
  last_utm_medium: campo,
  last_utm_campaign: campo,
  last_seen_at: campo,
});

/**
 * Qualquer valor → origem valida, sem nunca falhar.
 *
 * O schema nao valida o valor cru de proposito: um campo grande demais faria
 * `safeParse` reprovar a origem inteira — e, no payload do pedido, o pedido
 * inteiro. Primeiro `cleanAttribution` corta e limpa; o schema confere o que
 * sobrou.
 */
export function sanitizeAttribution(value: unknown): OrderAttribution {
  const parsed = attributionSchema.safeParse(cleanAttribution(value));
  return parsed.success ? parsed.data : {};
}

/** Valor cru do cookie `domguima_origem` → origem. Cookie ausente ou adulterado vira `{}`. */
export function parseOrigemCookie(raw: string | undefined | null): OrderAttribution {
  if (!raw) return {};
  // O Next costuma entregar o valor ja decodificado; o navegador grava
  // codificado. Tentar os dois cobre as duas pontas.
  for (const texto of [raw, decodificar(raw)]) {
    try {
      return sanitizeAttribution(JSON.parse(texto));
    } catch {
      // Formato inesperado: tenta a proxima forma, e sem nenhuma segue sem origem.
    }
  }
  return {};
}

function decodificar(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Caminho interno da loja: comeca com UMA "/" e nao tem espaco, caractere de
 * controle nem barra invertida. `//site.com` e `/\site.com` o navegador trata
 * como outro site, e ele descarta tab e quebra de linha da URL (`/\t/site.com`
 * viraria `//site.com`), por isso `\s` fica de fora tambem.
 */
const CAMINHO_INTERNO = /^\/(?![/\\])[^\s\\]*$/;

export function isInternalPagePath(value: string): boolean {
  return CAMINHO_INTERNO.test(value);
}

/**
 * Pagina de onde o cliente chamou (parametro `pagina` da rota publica do
 * WhatsApp) → so o caminho interno, sem query nem fragmento, ou `""`.
 *
 * Qualquer pessoa pode chamar a rota com a `pagina` que quiser, e o painel de
 * trafego mostra esse valor como link: endereco de fora vira `""` aqui, em vez
 * de uma isca de phishing com cara de pagina da loja.
 */
export function internalPagePath(value: string): string {
  const caminho = value.trim().split(/[?#]/)[0] ?? "";
  return isInternalPagePath(caminho) ? caminho : "";
}

/** Campanha do primeiro contato rastreavel: e a que o relatorio credita. */
export function attributionCampaign(attribution: OrderAttribution): string {
  return attribution.utm_campaign?.trim() ?? "";
}

/** Campanha mais recente (a que o cliente acabou de clicar), para o atendente ver na conversa. */
export function latestCampaign(attribution: OrderAttribution): string {
  return (attribution.last_utm_campaign || attribution.utm_campaign || "").trim();
}

// ---------------------------------------------------------------------------
// Rotulos e filtros (painel)
// ---------------------------------------------------------------------------

/** `hasOwnProperty` e nao `in`: "constructor" ou "toString" nao sao origem. */
export function isTrafficSource(value: unknown): value is TrafficSource {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TRAFFIC_SOURCE_LABELS, value);
}

export function isOrderChannel(value: unknown): value is OrderChannel {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ORDER_CHANNEL_LABELS, value);
}

/**
 * Rotulo de uma origem gravada. Valor fora da lista (texto livre antigo)
 * aparece como veio, em vez de sumir.
 */
export function trafficSourceLabel(source: string): string {
  if (!source) return ORIGIN_NOT_INFORMED_LABEL;
  return isTrafficSource(source) ? TRAFFIC_SOURCE_LABELS[source] : source;
}

export function orderChannelLabel(channel: string): string {
  if (!channel) return ORIGIN_NOT_INFORMED_LABEL;
  return isOrderChannel(channel) ? ORDER_CHANNEL_LABELS[channel] : channel;
}

// ---------------------------------------------------------------------------
// Pedido
// ---------------------------------------------------------------------------

/**
 * Pedido lido do banco ou do arquivo local → pedido com os campos de origem
 * sempre presentes.
 *
 * Antes da migration 202609210003 (colada a mao no SQL Editor) a tabela nao
 * tem essas colunas, e o arquivo local tem pedidos gravados antes delas: nos
 * dois casos o valor falta e vira o padrao (`""`, `{}`, `null`). Valor
 * desconhecido tambem vira `""` — o TypeScript e a unica guarda de colunas de
 * texto livre, como em `sales_orders.status`.
 *
 * `customer_key` ausente e calculado do proprio pedido, pela mesma regra do
 * preenchimento da migration: e derivado, nao inventado.
 */
export function normalizeOrderOrigin(order: SalesOrderRecord): SalesOrderRecord {
  const row = order as Partial<SalesOrderRecord>;
  return {
    ...order,
    channel: isOrderChannel(row.channel) ? row.channel : "",
    source: isTrafficSource(row.source) ? row.source : "",
    attribution: sanitizeAttribution(row.attribution),
    lead_id: textoOuNulo(row.lead_id),
    customer_key: textoOuNulo(row.customer_key) ?? customerKey(row.customer ?? {}),
    visitor_id: textoOuNulo(row.visitor_id),
  };
}

function textoOuNulo(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
