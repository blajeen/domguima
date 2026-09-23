import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sanitizeAttribution } from "@/lib/services/origem";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalize } from "@/lib/utils/format";
import { onlyDigits } from "@/lib/utils/validators";
import { hasSupabaseConfig } from "./config";
import { customerKey, phoneKey } from "./customers";
import {
  LEAD_KIND_LABELS,
  LEAD_LOST_REASON_LABELS,
  LEAD_STAGE_LABELS,
  OPEN_LEAD_STAGES,
  type LeadDistributionMode,
  type LeadItemSnapshot,
  type LeadKind,
  type LeadLostReason,
  type LeadRecord,
  type LeadStage,
  type OrderAttribution,
} from "./types";

/**
 * ATENDIMENTOS (leads)
 * ====================
 *
 * Mesma arquitetura do livro-razao de pedidos e pelo mesmo motivo: leads
 * crescem sem teto e nao podem morar no JSONB do catalogo, que e reescrito
 * inteiro a cada salvamento. Aqui a leitura e uma query dedicada e a escrita
 * passa pelas RPCs `create_lead_v1`/`update_lead_v1` (transacao unica, com a
 * escolha do atendente travada no banco).
 *
 * Os leads NAO entram em `CatalogState`: nada disso passa por
 * `replace_catalog_state`.
 *
 * Antes da migration 202609210002 (que e colada a mao no SQL Editor) a tabela
 * nao existe. Nesse caso tudo aqui avisa no console e devolve vazio, em vez de
 * derrubar a pagina ou o redirect do WhatsApp — o cliente sempre fala com a
 * loja, mesmo que o CRM esteja fora do ar.
 */

const AVISO_MIGRATION = "Atendimentos indisponiveis: aplique supabase/migrations/202609210002_atendimentos.sql no SQL Editor.";

/** O que o painel diz ao operador quando a tabela de atendimentos ainda nao existe no banco. */
export const LEAD_CRM_UNAVAILABLE_MESSAGE = "Os atendimentos ainda não existem no banco. Aplique supabase/migrations/202609210002_atendimentos.sql no SQL Editor.";

/** Persistencia local de desenvolvimento (sem Supabase), no espirito de data/admin-catalog.json. */
const LOCAL_FILE = join(process.cwd(), "data", "admin-leads.json");

export interface LeadCandidate {
  id: string;
  name: string;
}

export interface LeadInput {
  kind: LeadKind;
  /** `null`/ausente = fila livre (ou escolha automatica, conforme o modo). */
  sellerId?: string | null;
  /** username do painel, "customer" ou vazio (a RPC preenche o automatico). */
  assignedBy?: string | null;
  customerName?: string;
  customerPhone?: string;
  productId?: string | null;
  items?: LeadItemSnapshot[];
  message?: string;
  pagePath?: string;
  /** Um `TrafficSource` (ver classifyTrafficSource em services/origem.ts). */
  source?: string;
  attribution?: OrderAttribution;
  visitorId?: string | null;
  orderId?: string | null;
  notes?: string;
  createdBy?: string;
  stage?: LeadStage;
}

export interface LeadAuditDraft {
  actor_id: string;
  action: string;
  entity_id?: string;
  before_data?: unknown;
  after_data?: unknown;
}

export interface CreateLeadOptions {
  /** Quem pode receber, quando o modo e automatico. Ordem = ordem do painel. */
  candidates?: LeadCandidate[];
  mode?: LeadDistributionMode | "manual";
  audit?: LeadAuditDraft;
}

export interface CreateLeadResult {
  /** `null` quando o CRM nao esta disponivel — quem chamou decide o que fazer. */
  lead: LeadRecord | null;
  alreadyExisted: boolean;
}

export interface UpdateLeadResult {
  lead: LeadRecord | null;
  found: boolean;
  /**
   * `true` so quando a tabela/RPC ainda nao existe no banco. Sem esta
   * separacao, "esse atendimento nao existe mais" e "aplique a migration"
   * chegariam ao operador com a mesma mensagem — e a segunda nao faz sentido
   * nenhum no modo local, onde nem ha Supabase.
   */
  unavailable: boolean;
}

/** Campos que a RPC aceita mudar. A presenca da chave e que conta. */
export interface LeadPatch {
  seller_id?: string | null;
  assigned_by?: string | null;
  stage?: LeadStage;
  lost_reason?: LeadLostReason | null;
  notes?: string;
  order_id?: string | null;
  customer_name?: string;
  customer_phone?: string;
  customer_key?: string | null;
}

export interface LeadFilters {
  sellerId?: string;
  /** `true` = somente a fila livre (sem atendente). */
  unassigned?: boolean;
  /** `true` = somente etapas abertas (nem ganho nem perdido). */
  open?: boolean;
  stage?: LeadStage;
  source?: string;
  /** YYYY-MM-DD em America/Sao_Paulo. */
  from?: string;
  to?: string;
  /**
   * Somente os atendimentos destas chaves de cliente (todos os telefones e
   * CPF/CNPJ de um cliente, ver `identitiesOf`). Lista vazia = nenhum.
   */
  customerKeys?: readonly string[];
  /** Busca livre em nome, telefone, mensagem e produto (aplicada em memoria). */
  q?: string;
}

/** Teto de uma consulta de atendimentos, no mesmo espirito do limite de pedidos. */
export const LEAD_LIST_LIMIT = 500;

export interface LeadPage {
  leads: LeadRecord[];
  /** `true` = a consulta bateu no teto; existem atendimentos mais antigos fora dela. */
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// Leitura e escrita
// ---------------------------------------------------------------------------

export async function createLead(input: LeadInput, options: CreateLeadOptions = {}): Promise<CreateLeadResult> {
  const payload = montarPayload(input);
  const candidates = options.candidates ?? [];
  const mode = options.mode ?? "manual";
  const audit = options.audit ? { ...options.audit, id: randomUUID(), entity_type: "lead", entity_id: options.audit.entity_id ?? payload.id } : null;

  if (hasSupabaseConfig()) {
    const { data, error } = await createSupabaseAdminClient().rpc("create_lead_v1", {
      p_lead: payload,
      p_candidates: candidates,
      p_mode: mode,
      p_audit: audit,
    });
    if (error) {
      if (crmAusente(error)) {
        console.warn(AVISO_MIGRATION, error.message);
        return { lead: null, alreadyExisted: false };
      }
      throw new Error(`Nao foi possivel registrar o atendimento: ${error.message}`);
    }
    const resposta = data as { already_existed?: boolean; lead?: unknown };
    return { lead: normalizeLead(resposta?.lead), alreadyExisted: Boolean(resposta?.already_existed) };
  }

  return mutarLeadsLocais((leads) => {
    const repetido = leadRepetido(leads, payload);
    if (repetido) return { lead: repetido, alreadyExisted: true };

    const sellerId = payload.seller_id ?? escolherAtendente(leads, candidates, mode);
    const assignedBy = payload.seller_id ? payload.assigned_by || "customer" : `auto:${mode}`;
    const agora = new Date().toISOString();
    const lead: LeadRecord = {
      ...payload,
      seller_id: sellerId,
      assigned_at: sellerId ? agora : null,
      assigned_by: sellerId ? assignedBy : null,
      lost_reason: null,
      closed_at: null,
      updated_at: agora,
    };
    leads.unshift(lead);
    return { lead, alreadyExisted: false };
  });
}

export async function listLeads(filters: LeadFilters = {}, limit = LEAD_LIST_LIMIT): Promise<LeadRecord[]> {
  return (await listLeadsPage(filters, limit)).leads;
}

/**
 * A mesma lista, dizendo se ela foi CORTADA pelo teto.
 *
 * A consulta traz os mais recentes do periodo e a busca livre e aplicada em
 * memoria (em `normalize`, que ignora acento — `ilike` no banco nao ignoraria).
 * Sem o aviso de corte, um cliente de quatro meses atras simplesmente nao
 * aparece e a tela responde "nenhum atendimento corresponde aos filtros", como
 * se o registro tivesse sumido. Quem consome mostra o recorte na tela.
 */
export async function listLeadsPage(filters: LeadFilters = {}, limit = LEAD_LIST_LIMIT): Promise<LeadPage> {
  if (hasSupabaseConfig()) {
    const { data, error } = await consultaFiltrada(filters, false).order("created_at", { ascending: false }).limit(limit);
    if (error) {
      if (crmAusente(error)) console.warn(AVISO_MIGRATION, error.message);
      else console.warn("Nao foi possivel listar os atendimentos:", error.message);
      return { leads: [], truncated: false };
    }
    const linhas = data ?? [];
    const leads = linhas.flatMap((row) => {
      const lead = normalizeLead(row);
      return lead ? [lead] : [];
    });
    return { leads: filtrarPorBusca(leads, filters.q), truncated: linhas.length >= limit };
  }

  const todos = (await lerLeadsLocais()).filter((lead) => combina(lead, filters));
  return { leads: filtrarPorBusca(todos.slice(0, limit), filters.q), truncated: todos.length > limit };
}

/**
 * Quantos atendimentos batem com os filtros — contagem EXATA, sem o teto da
 * lista.
 *
 * Existe para os numeros do topo do painel (fila livre, chegaram hoje, em
 * aberto por atendente). Calcula-los sobre a lista dos 500 mais recentes fazia
 * o card "Fila livre" mostrar 0 enquanto havia atendimento sem dono mais antigo
 * no banco. No Supabase e um `count` sem trazer linhas; a busca livre (`q`) nao
 * entra porque so existe em memoria.
 */
export async function countLeads(filters: Omit<LeadFilters, "q"> = {}): Promise<number> {
  if (hasSupabaseConfig()) {
    const { count, error } = await consultaFiltrada(filters, true);
    if (error) {
      if (crmAusente(error)) console.warn(AVISO_MIGRATION, error.message);
      else console.warn("Nao foi possivel contar os atendimentos:", error.message);
      return 0;
    }
    return count ?? 0;
  }

  return (await lerLeadsLocais()).filter((lead) => combina(lead, filters)).length;
}

export async function updateLead(id: string, patch: LeadPatch, audit?: LeadAuditDraft): Promise<UpdateLeadResult> {
  const auditoria = audit ? { ...audit, id: randomUUID(), entity_type: "lead", entity_id: audit.entity_id ?? id } : null;

  if (hasSupabaseConfig()) {
    const { data, error } = await createSupabaseAdminClient().rpc("update_lead_v1", {
      p_id: id,
      p_patch: patch,
      p_audit: auditoria,
    });
    if (error) {
      if (crmAusente(error)) {
        console.warn(AVISO_MIGRATION, error.message);
        return { lead: null, found: false, unavailable: true };
      }
      throw new Error(`Nao foi possivel atualizar o atendimento: ${error.message}`);
    }
    const resposta = data as { found?: boolean; lead?: unknown };
    return { lead: normalizeLead(resposta?.lead), found: Boolean(resposta?.found), unavailable: false };
  }

  return mutarLeadsLocais((leads) => {
    const indice = leads.findIndex((lead) => lead.id === id);
    if (indice < 0) return { lead: null, found: false, unavailable: false };
    const lead = aplicarPatchLocal(leads[indice], patch);
    leads[indice] = lead;
    return { lead, found: true, unavailable: false };
  });
}

/** Um atendimento pelo id. Falha ou tabela ausente avisam e devolvem `null`. */
export async function findLead(id: string): Promise<LeadRecord | null> {
  if (!id) return null;

  if (hasSupabaseConfig()) {
    const { data, error } = await createSupabaseAdminClient().from("leads").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (crmAusente(error)) console.warn(AVISO_MIGRATION, error.message);
      else console.warn("Nao foi possivel buscar o atendimento:", error.message);
      return null;
    }
    return normalizeLead(data);
  }

  return (await lerLeadsLocais()).find((lead) => lead.id === id) ?? null;
}

/**
 * Apaga atendimentos em definitivo e devolve quantos sairam.
 *
 * Quem usa hoje e a exclusao de pedidos: o atendimento criado pelo checkout e
 * uma copia do pedido (nome, telefone, itens, observacao) e nao pode continuar
 * no painel depois que o dono apagou o pedido — inclusive quando o proprio
 * cliente pediu a eliminacao dos dados, como a politica de privacidade promete.
 *
 * Escrita direta com o client de servico, como `deleteOrderRecords` faz com os
 * pedidos: a RLS sem policy continua barrando anon/authenticated. Best-effort:
 * falha (inclusive tabela ausente) avisa e devolve o que ja tinha saido.
 */
export async function deleteLeads(ids: readonly string[]): Promise<number> {
  const alvo = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!alvo.length) return 0;

  if (hasSupabaseConfig()) {
    let removidos = 0;
    for (let inicio = 0; inicio < alvo.length; inicio += 100) {
      const lote = alvo.slice(inicio, inicio + 100);
      const { error, count } = await createSupabaseAdminClient().from("leads").delete({ count: "exact" }).in("id", lote);
      if (error) {
        if (crmAusente(error)) console.warn(AVISO_MIGRATION, error.message);
        else console.warn("Nao foi possivel apagar os atendimentos:", error.message);
        return removidos;
      }
      removidos += count ?? lote.length;
    }
    return removidos;
  }

  const procurados = new Set(alvo);
  return mutarLeadsLocais((leads) => {
    const antes = leads.length;
    const restantes = leads.filter((lead) => !procurados.has(lead.id));
    leads.splice(0, leads.length, ...restantes);
    return antes - restantes.length;
  });
}

export async function findLeadByOrder(orderId: string): Promise<LeadRecord | null> {
  if (!orderId) return null;

  if (hasSupabaseConfig()) {
    const { data, error } = await createSupabaseAdminClient()
      .from("leads")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (crmAusente(error)) console.warn(AVISO_MIGRATION, error.message);
      else console.warn("Nao foi possivel buscar o atendimento do pedido:", error.message);
      return null;
    }
    return normalizeLead(data);
  }

  return (await lerLeadsLocais()).find((lead) => lead.order_id === orderId) ?? null;
}

/**
 * Atendimentos vinculados a varios pedidos de uma vez (cancelamento em massa).
 *
 * Uma consulta por lote em vez de uma por pedido: cancelar 50 pedidos de um
 * lancamento em lote — que nunca tem atendimento — nao pode custar 50 idas ao
 * banco so para descobrir que nao ha nada a fechar. Lotes de 100 ids mantem a
 * URL do PostgREST num tamanho seguro.
 */
export async function findLeadsByOrders(orderIds: readonly string[]): Promise<LeadRecord[]> {
  const ids = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return [];

  if (hasSupabaseConfig()) {
    const encontrados: LeadRecord[] = [];
    for (let inicio = 0; inicio < ids.length; inicio += 100) {
      const { data, error } = await createSupabaseAdminClient()
        .from("leads")
        .select("*")
        .in("order_id", ids.slice(inicio, inicio + 100));
      if (error) {
        if (crmAusente(error)) console.warn(AVISO_MIGRATION, error.message);
        else console.warn("Nao foi possivel buscar os atendimentos dos pedidos:", error.message);
        return encontrados;
      }
      for (const row of data ?? []) {
        const lead = normalizeLead(row);
        if (lead) encontrados.push(lead);
      }
    }
    return encontrados;
  }

  const procurados = new Set(ids);
  return (await lerLeadsLocais()).filter((lead) => lead.order_id !== null && procurados.has(lead.order_id));
}

/** O que o relatorio de trafego precisa de cada atendimento — sem nome, telefone nem mensagem. */
export type LeadTrafficRow = Pick<LeadRecord, "id" | "kind" | "source" | "attribution" | "page_path" | "created_at">;

export interface LeadTrafficPage {
  rows: LeadTrafficRow[];
  /** A leitura parou no teto `LEAD_REPORT_LIMIT`: os numeros olham so os mais recentes. */
  truncated: boolean;
  /** A tabela ainda nao existe (migration 202609210002 nao aplicada) ou a consulta falhou. */
  unavailable: boolean;
  /**
   * A consulta falhou no MEIO da paginacao: `rows` tem so as paginas lidas antes
   * do erro (os atendimentos mais recentes), e os numeros do periodo ficam baixos.
   */
  partial: boolean;
}

/** Teto do relatorio. Folgado de proposito: e ~20 paginas de 1.000 linhas leves. */
export const LEAD_REPORT_LIMIT = 20_000;
const PAGINA_DO_RELATORIO = 1_000;

/**
 * Atendimentos do periodo para somar por origem, campanha e pagina.
 *
 * Diferente da lista da tela de Atendimento (teto de 500, linha completa), aqui
 * a soma precisa ver o periodo INTEIRO: o relatorio de um mes movimentado nao
 * pode contar so os 500 ultimos cliques. Por isso a consulta traz so as colunas
 * da conta e pagina de 1.000 em 1.000 (o maximo que o PostgREST devolve por vez).
 */
export async function listLeadTraffic(filters: { from?: string; to?: string }): Promise<LeadTrafficPage> {
  if (hasSupabaseConfig()) {
    const rows: LeadTrafficRow[] = [];
    for (let inicio = 0; inicio < LEAD_REPORT_LIMIT; inicio += PAGINA_DO_RELATORIO) {
      let query = createSupabaseAdminClient()
        .from("leads")
        .select("id, kind, source, attribution, page_path, created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(inicio, inicio + PAGINA_DO_RELATORIO - 1);
      if (filters.from) query = query.gte("created_at", inicioDoDia(filters.from));
      if (filters.to) query = query.lte("created_at", fimDoDia(filters.to));
      const { data, error } = await query;
      if (error) {
        if (crmAusente(error)) console.warn(AVISO_MIGRATION, error.message);
        else console.warn("Nao foi possivel ler os atendimentos do relatorio:", error.message);
        // Erro na 1a pagina: nada lido (aviso azul). Da 2a em diante: o que
        // veio e so parte do periodo (aviso ambar) — nunca numero parcial
        // apresentado como completo.
        return { rows, truncated: false, unavailable: rows.length === 0, partial: rows.length > 0 };
      }
      for (const row of data ?? []) {
        const lead = normalizeLead(row);
        if (lead) rows.push({ id: lead.id, kind: lead.kind, source: lead.source, attribution: lead.attribution, page_path: lead.page_path, created_at: lead.created_at });
      }
      if (!data || data.length < PAGINA_DO_RELATORIO) return { rows, truncated: false, unavailable: false, partial: false };
    }
    return { rows, truncated: true, unavailable: false, partial: false };
  }

  const todos = (await lerLeadsLocais()).filter((lead) => combina(lead, { from: filters.from, to: filters.to }));
  return {
    rows: todos.slice(0, LEAD_REPORT_LIMIT).map((lead) => ({ id: lead.id, kind: lead.kind, source: lead.source, attribution: lead.attribution, page_path: lead.page_path, created_at: lead.created_at })),
    truncated: todos.length > LEAD_REPORT_LIMIT,
    unavailable: false,
    partial: false,
  };
}

/** O que a tela de Clientes precisa de cada atendimento em aberto: so a chave do cliente. */
export type OpenLeadKeyRow = Pick<LeadRecord, "customer_key" | "stage">;

/**
 * Chave do cliente de cada atendimento ainda aberto (Novo, Em atendimento,
 * Orcamento enviado, Aguardando pagamento).
 *
 * Serve para a tela de Clientes avisar "atendimento em aberto" antes de alguem
 * recontatar quem ja esta sendo atendido. Traz so duas colunas, em paginas de
 * 1.000 como o relatorio de trafego: cliques de WhatsApp que ninguem fechou se
 * acumulam, e o teto de 500 da lista deixaria clientes de fora. Best-effort:
 * falha ou tabela ausente devolvem o que ja foi lido (a tela so perde o aviso).
 */
export async function listOpenLeadKeys(): Promise<OpenLeadKeyRow[]> {
  if (hasSupabaseConfig()) {
    const rows: OpenLeadKeyRow[] = [];
    for (let inicio = 0; inicio < LEAD_REPORT_LIMIT; inicio += PAGINA_DO_RELATORIO) {
      const { data, error } = await createSupabaseAdminClient()
        .from("leads")
        .select("id, customer_key, stage")
        .in("stage", [...OPEN_LEAD_STAGES])
        .not("customer_key", "is", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(inicio, inicio + PAGINA_DO_RELATORIO - 1);
      if (error) {
        if (crmAusente(error)) console.warn(AVISO_MIGRATION, error.message);
        else console.warn("Nao foi possivel ler os atendimentos em aberto:", error.message);
        return rows;
      }
      for (const row of data ?? []) {
        const stage = texto(row.stage);
        const chave = texto(row.customer_key);
        if (chave && stage in LEAD_STAGE_LABELS) rows.push({ customer_key: chave, stage: stage as LeadStage });
      }
      if (!data || data.length < PAGINA_DO_RELATORIO) return rows;
    }
    return rows;
  }

  return (await lerLeadsLocais())
    .filter((lead) => lead.customer_key && isOpenLeadStage(lead.stage))
    .map((lead) => ({ customer_key: lead.customer_key, stage: lead.stage }));
}

// ---------------------------------------------------------------------------
// Regras puras reaproveitadas pelo painel
// ---------------------------------------------------------------------------

/**
 * Telefone em digitos sem o DDI, porque o mesmo cliente aparece ora como
 * "(34) 99999-9999" (pedido do site) ora como "5534999999999" (WhatsApp).
 *
 * A regra mora em customers.ts (`phoneKey`), a mesma que o pedido usa para a
 * chave do cliente: duas copias sairiam do ar uma da outra.
 */
export function leadCustomerKey(phone: string): string {
  return phoneKey(phone);
}

/** Dia YYYY-MM-DD em America/Sao_Paulo — o fuso em que a loja trabalha. */
export function leadLocalDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export function isOpenLeadStage(stage: LeadStage): boolean {
  return OPEN_LEAD_STAGES.includes(stage);
}

// ---------------------------------------------------------------------------
// Internos
// ---------------------------------------------------------------------------

/**
 * Consulta em `leads` com os filtros que o banco sabe aplicar (tudo menos a
 * busca livre). A mesma montagem serve a lista e a contagem: `somenteContar`
 * pede so o total (`head`), sem trafegar linha nenhuma.
 */
function consultaFiltrada(filters: Omit<LeadFilters, "q">, somenteContar: boolean) {
  let query = createSupabaseAdminClient()
    .from("leads")
    .select("*", somenteContar ? { count: "exact", head: true } : undefined);
  if (filters.unassigned) query = query.is("seller_id", null);
  else if (filters.sellerId) query = query.eq("seller_id", filters.sellerId);
  if (filters.open) query = query.in("stage", [...OPEN_LEAD_STAGES]);
  if (filters.stage) query = query.eq("stage", filters.stage);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.from) query = query.gte("created_at", inicioDoDia(filters.from));
  if (filters.to) query = query.lte("created_at", fimDoDia(filters.to));
  // Lista vazia tem de dar zero linhas, e nao "sem filtro": "" nunca e gravado
  // (chave ausente vira null), entao `in ("")` nao acha nada.
  if (filters.customerKeys) query = query.in("customer_key", filters.customerKeys.length ? [...filters.customerKeys] : [""]);
  return query;
}

/** Tabela ou funcao que ainda nao existe no banco, e nao uma falha de rede. */
function crmAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code ?? "")) return true;
  return /could not find the (table|function)|does not exist|schema cache/i.test(error.message ?? "");
}

interface LeadPayload {
  id: string;
  kind: LeadKind;
  stage: LeadStage;
  seller_id: string | null;
  assigned_by: string | null;
  customer_name: string;
  customer_phone: string;
  customer_key: string | null;
  product_id: string | null;
  items: LeadItemSnapshot[];
  message: string;
  page_path: string;
  source: string;
  attribution: OrderAttribution;
  visitor_id: string | null;
  order_id: string | null;
  notes: string;
  created_by: string;
  created_at: string;
}

function montarPayload(input: LeadInput): LeadPayload {
  const phone = onlyDigits(input.customerPhone ?? "");
  return {
    id: randomUUID(),
    kind: input.kind,
    stage: input.stage ?? "new",
    seller_id: input.sellerId?.trim() || null,
    assigned_by: input.assignedBy?.trim() || null,
    customer_name: (input.customerName ?? "").trim().slice(0, 140),
    customer_phone: phone,
    customer_key: customerKey({ phone }),
    product_id: input.productId?.trim() || null,
    items: (input.items ?? []).slice(0, 50),
    message: (input.message ?? "").slice(0, 4_000),
    page_path: (input.pagePath ?? "").slice(0, 300),
    source: input.source?.trim() || "direct",
    attribution: sanitizeAttribution(input.attribution),
    visitor_id: input.visitorId?.trim() || null,
    order_id: input.orderId?.trim() || null,
    notes: (input.notes ?? "").slice(0, 1_000),
    created_by: input.createdBy?.trim() || "public-site",
    created_at: new Date().toISOString(),
  };
}

/**
 * Converte uma linha crua (banco ou arquivo) num LeadRecord confiavel.
 *
 * As colunas sao text livre no banco — a mesma escolha de `sales_orders.status`
 * — entao o TypeScript e a unica guarda: valor desconhecido vira o padrao em
 * vez de vazar para a UI como etiqueta em branco.
 */
function normalizeLead(raw: unknown): LeadRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const kind = texto(row.kind);
  const stage = texto(row.stage);
  const lostReason = texto(row.lost_reason);
  return {
    id: texto(row.id) || randomUUID(),
    kind: kind in LEAD_KIND_LABELS ? (kind as LeadKind) : "manual",
    stage: stage in LEAD_STAGE_LABELS ? (stage as LeadStage) : "new",
    seller_id: texto(row.seller_id) || null,
    assigned_at: texto(row.assigned_at) || null,
    assigned_by: texto(row.assigned_by) || null,
    customer_name: texto(row.customer_name),
    customer_phone: texto(row.customer_phone),
    customer_key: texto(row.customer_key) || null,
    product_id: texto(row.product_id) || null,
    items: normalizeItems(row.items),
    message: texto(row.message),
    page_path: texto(row.page_path),
    source: texto(row.source) || "direct",
    attribution: sanitizeAttribution(row.attribution),
    visitor_id: texto(row.visitor_id) || null,
    order_id: texto(row.order_id) || null,
    lost_reason: lostReason in LEAD_LOST_REASON_LABELS ? (lostReason as LeadLostReason) : null,
    notes: texto(row.notes),
    closed_at: texto(row.closed_at) || null,
    created_by: texto(row.created_by) || "public-site",
    created_at: texto(row.created_at) || new Date().toISOString(),
    updated_at: texto(row.updated_at) || texto(row.created_at) || new Date().toISOString(),
  };
}

function texto(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function normalizeItems(value: unknown): LeadItemSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const quantity = Number(row.quantity);
    return [{
      product_id: texto(row.product_id),
      product_name: texto(row.product_name),
      quantity: Number.isFinite(quantity) && quantity > 0 ? Math.trunc(quantity) : 1,
    }];
  }).slice(0, 50);
}

function filtrarPorBusca(leads: LeadRecord[], q?: string): LeadRecord[] {
  const termo = normalize(q ?? "");
  if (!termo) return leads;
  return leads.filter((lead) => normalize(`${lead.customer_name} ${lead.customer_phone} ${lead.message} ${lead.page_path} ${lead.product_id ?? ""}`).includes(termo));
}

/** Brasil nao tem mais horario de verao desde 2019: o deslocamento e fixo. */
function inicioDoDia(dia: string): string {
  return `${dia}T00:00:00.000-03:00`;
}

function fimDoDia(dia: string): string {
  return `${dia}T23:59:59.999-03:00`;
}

// ---------------------------------------------------------------------------
// Caminho local (dev sem Supabase): mesma semantica, gravada em arquivo
// ---------------------------------------------------------------------------

/**
 * Fila propria, pelo mesmo motivo de `mutateCatalogState`: ler → alterar →
 * gravar sem serializar faz a ultima escrita apagar a anterior.
 */
let leadQueue: Promise<unknown> = Promise.resolve();

async function lerLeadsLocais(): Promise<LeadRecord[]> {
  try {
    const bruto: unknown = JSON.parse(await readFile(LOCAL_FILE, "utf8"));
    if (!Array.isArray(bruto)) return [];
    return bruto.flatMap((item) => {
      const lead = normalizeLead(item);
      return lead ? [lead] : [];
    });
  } catch {
    return [];
  }
}

function mutarLeadsLocais<T>(change: (leads: LeadRecord[]) => T): Promise<T> {
  const run = async (): Promise<T> => {
    const leads = await lerLeadsLocais();
    const resultado = change(leads);
    await mkdir(dirname(LOCAL_FILE), { recursive: true });
    await writeFile(LOCAL_FILE, JSON.stringify(leads.slice(0, 5_000), null, 2), "utf8");
    return resultado;
  };
  const result = leadQueue.then(run, run);
  leadQueue = result.catch(() => undefined);
  return result;
}

/**
 * Mesma janela de 90s da RPC: clicar duas vezes no mesmo botao e uma conversa so.
 *
 * O atendente escolhido entra na chave quando existe: o cliente que clica em
 * Juliano, muda de ideia e clica em Gabriel abriu OUTRA conversa, em outro
 * telefone — reaproveitar o registro anterior deixaria o painel apontando para
 * quem nao esta falando com ele. Sem escolha (modos automaticos, onde o seller
 * so e definido depois) a chave continua sendo visitante + tipo + produto.
 */
function leadRepetido(leads: readonly LeadRecord[], payload: LeadPayload): LeadRecord | null {
  if (!payload.visitor_id) return null;
  const limite = Date.now() - 90_000;
  return leads.find((lead) =>
    lead.visitor_id === payload.visitor_id
    && lead.kind === payload.kind
    && (lead.product_id ?? "") === (payload.product_id ?? "")
    && (!payload.seller_id || (lead.seller_id ?? "") === payload.seller_id)
    && new Date(lead.created_at).getTime() > limite) ?? null;
}

/** Mesma ordenacao do `order by` da RPC: menos ocupado, depois quem recebeu ha mais tempo. */
function escolherAtendente(leads: readonly LeadRecord[], candidates: readonly LeadCandidate[], mode: string): string | null {
  if (!candidates.length || (mode !== "round_robin" && mode !== "least_busy")) return null;
  const cargas = candidates.map((candidate) => {
    const meus = leads.filter((lead) => lead.seller_id === candidate.id);
    return {
      id: candidate.id,
      abertos: mode === "least_busy" ? meus.filter((lead) => isOpenLeadStage(lead.stage)).length : 0,
      ultimo: meus.reduce<string | null>((maior, lead) => (lead.assigned_at && (!maior || lead.assigned_at > maior) ? lead.assigned_at : maior), null),
    };
  });
  cargas.sort((a, b) => {
    if (a.abertos !== b.abertos) return a.abertos - b.abertos;
    if (a.ultimo === b.ultimo) return a.id.localeCompare(b.id);
    if (a.ultimo === null) return -1;
    if (b.ultimo === null) return 1;
    return a.ultimo < b.ultimo ? -1 : 1;
  });
  return cargas[0]?.id ?? null;
}

function aplicarPatchLocal(lead: LeadRecord, patch: LeadPatch): LeadRecord {
  const agora = new Date().toISOString();
  const seller = "seller_id" in patch ? patch.seller_id?.trim() || null : lead.seller_id;
  const stage = patch.stage ?? lead.stage;
  const fechado = stage === "won" || stage === "lost";
  return {
    ...lead,
    seller_id: seller,
    assigned_at: "seller_id" in patch ? (seller ? agora : null) : lead.assigned_at,
    assigned_by: "seller_id" in patch ? (seller ? patch.assigned_by?.trim() || null : null) : lead.assigned_by,
    stage,
    closed_at: !fechado ? null : lead.stage === stage ? lead.closed_at ?? agora : agora,
    lost_reason: stage !== "lost" ? null : "lost_reason" in patch ? patch.lost_reason ?? null : lead.lost_reason,
    notes: "notes" in patch ? patch.notes ?? "" : lead.notes,
    order_id: "order_id" in patch ? patch.order_id?.trim() || null : lead.order_id,
    customer_name: "customer_name" in patch ? patch.customer_name ?? "" : lead.customer_name,
    customer_phone: "customer_phone" in patch ? patch.customer_phone ?? "" : lead.customer_phone,
    customer_key: "customer_key" in patch ? patch.customer_key?.trim() || null : lead.customer_key,
    updated_at: agora,
  };
}

function combina(lead: LeadRecord, filters: Omit<LeadFilters, "q">): boolean {
  if (filters.unassigned && lead.seller_id) return false;
  if (!filters.unassigned && filters.sellerId && lead.seller_id !== filters.sellerId) return false;
  if (filters.open && !isOpenLeadStage(lead.stage)) return false;
  if (filters.stage && lead.stage !== filters.stage) return false;
  if (filters.source && lead.source !== filters.source) return false;
  if (filters.customerKeys && !(lead.customer_key && filters.customerKeys.includes(lead.customer_key))) return false;
  const dia = leadLocalDate(lead.created_at);
  if (filters.from && dia < filters.from) return false;
  if (filters.to && dia > filters.to) return false;
  return true;
}
