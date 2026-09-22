import "server-only";

import { attributionCampaign, classifyTrafficSource, isOrderChannel, isTrafficSource, orderChannelLabel, trafficSourceLabel } from "@/lib/services/origem";
import type { CatalogState } from "./catalog-store";
import type { LeadTrafficRow } from "./leads";
import type { OrderChannel, SalesOrderRecord, TrafficSource } from "./types";

/**
 * Valor do filtro que pede os pedidos SEM canal ou origem (`""`): os gravados
 * antes do controle de trafego e os lancamentos do grupo sem origem. Nao
 * colide com nenhum `OrderChannel`/`TrafficSource`.
 */
export const ORIGIN_FILTER_NOT_INFORMED = "nao-informado";

export type ChannelFilter = OrderChannel | typeof ORIGIN_FILTER_NOT_INFORMED | "";
export type SourceFilter = TrafficSource | typeof ORIGIN_FILTER_NOT_INFORMED | "";

export interface ReportFilters {
  from: string;
  to: string;
  sellerId?: string;
  status?: "pending" | "completed" | "cancelled" | "all";
  /** `""` = todos os canais. */
  channel?: ChannelFilter;
  /** `""` = todas as origens. */
  source?: SourceFilter;
}

export interface SellerReportSummary {
  sellerId: string;
  sellerName: string;
  orders: number;
  units: number;
  salesCents: number;
  commissionCents: number;
}

/** Canais cujo trafego nasce fora do site: o cliente comprou no marketplace, nao chegou pela loja. */
const MARKETPLACE_CHANNELS: ReadonlySet<string> = new Set<OrderChannel>(["shopee", "mercado_livre", "magalu"]);

export function reportOrders(state: CatalogState, filters: ReportFilters): SalesOrderRecord[] {
  return state.operations.orders.filter((order) => {
    const day = localDate(order.created_at);
    return day >= filters.from && day <= filters.to
      && (!filters.sellerId || order.seller_id === filters.sellerId)
      && (!filters.status || filters.status === "all" || order.status === filters.status)
      && matchesOriginFilters(order, filters);
  });
}

/** Parametro `canal` da URL → filtro valido (valor desconhecido = sem filtro). */
export function channelFilterParam(value: unknown): ChannelFilter {
  if (value === ORIGIN_FILTER_NOT_INFORMED) return ORIGIN_FILTER_NOT_INFORMED;
  return isOrderChannel(value) ? value : "";
}

/** Parametro `origem` da URL → filtro valido (valor desconhecido = sem filtro). */
export function sourceFilterParam(value: unknown): SourceFilter {
  if (value === ORIGIN_FILTER_NOT_INFORMED) return ORIGIN_FILTER_NOT_INFORMED;
  return isTrafficSource(value) ? value : "";
}

/** O pedido passa pelos filtros de canal e origem? Usado pelo relatorio e pela lista de pedidos. */
export function matchesOriginFilters(order: Pick<SalesOrderRecord, "channel" | "source">, filters: { channel?: ChannelFilter; source?: SourceFilter }): boolean {
  const canal = filters.channel ?? "";
  const origem = filters.source ?? "";
  if (canal && order.channel !== (canal === ORIGIN_FILTER_NOT_INFORMED ? "" : canal)) return false;
  if (origem && order.source !== (origem === ORIGIN_FILTER_NOT_INFORMED ? "" : origem)) return false;
  return true;
}

export function sellerSummaries(orders: SalesOrderRecord[]): SellerReportSummary[] {
  const summaries = new Map<string, SellerReportSummary>();
  for (const order of orders.filter((item) => item.status === "completed")) {
    const current = summaries.get(order.seller_id) ?? { sellerId: order.seller_id, sellerName: order.seller_name, orders: 0, units: 0, salesCents: 0, commissionCents: 0 };
    current.orders += 1;
    current.units += order.total_units;
    current.salesCents += order.total_cents;
    current.commissionCents += order.commission_total_cents;
    summaries.set(order.seller_id, current);
  }
  return [...summaries.values()].sort((a, b) => b.salesCents - a.salesCents);
}

export function reportTotals(orders: SalesOrderRecord[]) {
  const completed = orders.filter((order) => order.status === "completed");
  return {
    orders: completed.length,
    units: completed.reduce((sum, order) => sum + order.total_units, 0),
    grossCents: completed.reduce((sum, order) => sum + order.gross_total_cents, 0),
    discountCents: completed.reduce((sum, order) => sum + order.discount_total_cents, 0),
    salesCents: completed.reduce((sum, order) => sum + order.total_cents, 0),
    commissionCents: completed.reduce((sum, order) => sum + order.commission_total_cents, 0),
    cancelled: orders.filter((order) => order.status === "cancelled").length,
  };
}

// ---------------------------------------------------------------------------
// Canal e origem (controle de trafego)
// ---------------------------------------------------------------------------

export interface ChannelReportSummary {
  /** O canal, ou `ORIGIN_FILTER_NOT_INFORMED` para os pedidos sem canal. */
  key: string;
  label: string;
  orders: number;
  units: number;
  salesCents: number;
}

/** Pedidos finalizados por canal de venda (tabela "Por canal" do financeiro). */
export function channelSummaries(orders: SalesOrderRecord[]): ChannelReportSummary[] {
  const summaries = new Map<string, ChannelReportSummary>();
  for (const order of orders.filter((item) => item.status === "completed")) {
    const key = order.channel || ORIGIN_FILTER_NOT_INFORMED;
    const current = summaries.get(key) ?? { key, label: orderChannelLabel(order.channel), orders: 0, units: 0, salesCents: 0 };
    current.orders += 1;
    current.units += order.total_units;
    current.salesCents += order.total_cents;
    summaries.set(key, current);
  }
  return [...summaries.values()].sort((a, b) => b.salesCents - a.salesCents);
}

export interface TrafficReportSummary {
  key: string;
  label: string;
  /** Atendimentos (cliques de WhatsApp, pedidos do site, lancados a mao). */
  leads: number;
  /** Pedidos FINALIZADOS. */
  orders: number;
  salesCents: number;
  /** Pedidos finalizados ÷ atendimentos. `null` quando nao houve atendimento. */
  conversion: number | null;
}

export interface CampaignReportSummary extends TrafficReportSummary {
  /** De onde a campanha trouxe gente ("Instagram", "Instagram / Facebook"). */
  sourceLabel: string;
}

/**
 * Atendimentos, pedidos finalizados, conversao e vendas por ORIGEM.
 *
 * Atendimento e pedido somam na mesma linha pela origem que cada um gravou.
 * Pedido sem atendimento (marketplace, lancado direto no painel) conta no
 * pedido e nao no atendimento — por isso a conversao de uma linha pode passar
 * de 100%, e a tela explica isso.
 */
export function sourceSummaries(orders: SalesOrderRecord[], leads: readonly LeadTrafficRow[]): TrafficReportSummary[] {
  const linhas = new Map<string, TrafficReportSummary>();
  const linha = (source: string) => {
    const key = source || ORIGIN_FILTER_NOT_INFORMED;
    const atual = linhas.get(key) ?? { key, label: trafficSourceLabel(source), leads: 0, orders: 0, salesCents: 0, conversion: null };
    linhas.set(key, atual);
    return atual;
  };
  for (const lead of leads) linha(lead.source).leads += 1;
  for (const order of orders.filter((item) => item.status === "completed")) {
    const atual = linha(order.source);
    atual.orders += 1;
    atual.salesCents += order.total_cents;
  }
  return ordenar([...linhas.values()].map(comConversao));
}

/**
 * O mesmo, por CAMPANHA (`utm_campaign` do primeiro contato rastreavel).
 * Nomes que so diferem em maiusculas ("Natal" e "natal") sao a mesma campanha.
 */
export function campaignSummaries(orders: SalesOrderRecord[], leads: readonly LeadTrafficRow[]): CampaignReportSummary[] {
  const linhas = new Map<string, CampaignReportSummary & { fontes: Set<string> }>();
  const linha = (attribution: LeadTrafficRow["attribution"]) => {
    const campanha = attributionCampaign(attribution);
    if (!campanha) return null;
    const key = campanha.toLowerCase();
    const atual = linhas.get(key) ?? { key, label: campanha, sourceLabel: "", leads: 0, orders: 0, salesCents: 0, conversion: null, fontes: new Set<string>() };
    atual.fontes.add(trafficSourceLabel(classifyTrafficSource(attribution)));
    linhas.set(key, atual);
    return atual;
  };
  for (const lead of leads) {
    const atual = linha(lead.attribution);
    if (atual) atual.leads += 1;
  }
  for (const order of orders.filter((item) => item.status === "completed")) {
    const atual = linha(order.attribution);
    if (!atual) continue;
    atual.orders += 1;
    atual.salesCents += order.total_cents;
  }
  return ordenar([...linhas.values()].map(({ fontes, ...resto }) => comConversao({ ...resto, sourceLabel: [...fontes].join(" / ") })));
}

export interface PageReportSummary {
  path: string;
  leads: number;
  /** Fatia do total de atendimentos do periodo, de 0 a 1. */
  share: number;
}

/** Paginas de onde sairam os atendimentos (botao de WhatsApp, checkout), das que mais geram para as que menos. */
export function pageSummaries(leads: readonly LeadTrafficRow[], limit = 15): PageReportSummary[] {
  const contagem = new Map<string, number>();
  for (const lead of leads) contagem.set(lead.page_path, (contagem.get(lead.page_path) ?? 0) + 1);
  const total = leads.length || 1;
  return [...contagem.entries()]
    .map(([path, quantidade]) => ({ path, leads: quantidade, share: quantidade / total }))
    .sort((a, b) => b.leads - a.leads || a.path.localeCompare(b.path))
    .slice(0, limit);
}

/**
 * Numeros do topo da pagina de trafego.
 *
 * Pedidos e vendas: todos os finalizados da propria loja. Os de marketplace
 * ficam de fora — o cliente comprou na Shopee e nunca passou pelo site nem
 * pelo WhatsApp da loja. Eles continuam na tabela por origem, na linha do
 * proprio marketplace.
 *
 * Conversao: so os pedidos que PASSARAM pelo funil (`fromFunnel`) sobre os
 * atendimentos. Lancamento do grupo (RETIRADA/ENTREGA) e pedido digitado no
 * painel nao geram atendimento; soma-los no numerador fazia o card passar de
 * 100% justamente no fluxo de venda mais comum da loja.
 */
export function trafficTotals(orders: SalesOrderRecord[], leads: readonly LeadTrafficRow[]) {
  const finalizados = orders.filter((order) => order.status === "completed" && !MARKETPLACE_CHANNELS.has(order.channel));
  const salesCents = finalizados.reduce((sum, order) => sum + order.total_cents, 0);
  const funnelOrders = finalizados.filter(fromFunnel).length;
  return {
    leads: leads.length,
    orders: finalizados.length,
    salesCents,
    funnelOrders,
    conversion: leads.length ? funnelOrders / leads.length : null,
  };
}

/**
 * O pedido pode ter atendimento? Nasceu no checkout do site (que sempre abre
 * um) ou ja esta ligado a um atendimento. Os lancados no painel e no grupo nao.
 */
function fromFunnel(order: SalesOrderRecord): boolean {
  return order.channel === "site" || Boolean(order.lead_id);
}

function comConversao<T extends TrafficReportSummary>(linha: T): T {
  return { ...linha, conversion: linha.leads > 0 ? linha.orders / linha.leads : null };
}

function ordenar<T extends TrafficReportSummary>(linhas: T[]): T[] {
  return linhas.sort((a, b) => b.leads - a.leads || b.orders - a.orders || b.salesCents - a.salesCents || a.label.localeCompare(b.label, "pt-BR"));
}

export function ordersReportCsv(orders: SalesOrderRecord[]): string {
  // Colunas novas entram no FIM: planilhas montadas em cima do arquivo antigo
  // continuam achando cada coluna no mesmo lugar.
  const headers = [
    "pedido", "data", "status", "vendedor", "cliente", "cpf", "cep", "endereco",
    "sku", "produto", "quantidade", "preco_tabela", "preco_vendido", "desconto",
    "total_item", "comissao_unitaria", "comissao_total",
    "canal", "origem", "campanha",
  ];
  const rows = orders.flatMap((order) => order.items.map((item) => [
    order.number,
    localDateTime(order.created_at),
    order.status === "completed" ? "Finalizado" : order.status === "pending" ? "Aguardando confirmação" : "Cancelado",
    order.seller_name,
    order.customer.name,
    order.customer.cpf,
    order.customer.cep,
    `${order.customer.street}, ${order.customer.number}${order.customer.complement ? ` - ${order.customer.complement}` : ""} - ${order.customer.neighborhood} - ${order.customer.city}/${order.customer.state}`,
    item.sku,
    item.product_name,
    item.quantity,
    money(item.list_unit_price_cents),
    money(item.unit_price_cents),
    money(item.discount_cents),
    money(item.line_total_cents),
    money(item.commission_unit_cents),
    money(item.commission_total_cents),
    orderChannelLabel(order.channel),
    trafficSourceLabel(order.source),
    attributionCampaign(order.attribution),
  ]));
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

export function defaultReportRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-");
  return { from: `${parts[0]}-${parts[1]}-01`, to: `${parts[0]}-${parts[1]}-${parts[2]}` };
}

export function validDateParam(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function localDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function localDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function money(cents: number) { return (cents / 100).toFixed(2).replace(".", ","); }

/**
 * Celula do CSV, a prova de formula.
 *
 * Texto que comeca com `=`, `+`, `-`, `@`, tab ou CR vira formula ativa no
 * Excel. Campanha (`utm_campaign`) chega de qualquer link divulgado por
 * terceiros e nome/endereco sao texto livre do checkout, entao o texto ganha um
 * `'` na frente (padrao OWASP para CSV injection). Numero continua numero.
 */
function csvCell(value: string | number) {
  const bruto = String(value);
  const text = typeof value === "string" && /^[=+\-@\t\r]/.test(bruto) && !/^[-+]?\d[\d.,]*$/.test(bruto) ? `'${bruto}` : bruto;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
