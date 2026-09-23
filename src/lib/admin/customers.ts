import { normalize } from "@/lib/utils/format";
import { onlyDigits } from "@/lib/utils/validators";
import {
  OPEN_LEAD_STAGES,
  type CustomerBook,
  type CustomerPurchaseLookup,
  type CustomerSegment,
  type CustomerSummary,
  type LeadRecord,
  type SalesOrderRecord,
} from "./types";

/**
 * CLIENTES
 * ========
 *
 * A loja nao tem cadastro de cliente: cada pedido e cada atendimento guarda um
 * retrato de quem comprou. Para reconhecer quem VOLTA, pedidos e atendimentos
 * gravam a mesma chave (`customer_key`), calculada aqui — num lugar so, porque
 * uma regra diferente no pedido e no atendimento faria o mesmo cliente aparecer
 * como dois.
 *
 * Puro de proposito (sem I/O, sem "server-only"): roda no servidor ao gravar,
 * no painel para agrupar e no navegador (o OrderComposer normaliza o telefone
 * e o CPF digitados antes de perguntar ao servidor). A migration 202609210003 repete a regra da chave em SQL para
 * preencher os pedidos antigos; mudar uma exige mudar a outra.
 */

// ---------------------------------------------------------------------------
// Regras de segmento — ajuste aqui, e so aqui.
// ---------------------------------------------------------------------------

/** A partir de quantas compras finalizadas o cliente e "Recorrente". */
export const RETURNING_MIN_ORDERS = 2;
/** VIP: pelo menos esta quantidade de compras... */
export const VIP_MIN_ORDERS = 3;
/** ...ou pelo menos este total gasto (R$ 3.000,00), mesmo numa compra so. */
export const VIP_MIN_TOTAL_CENTS = 300_000;
/** Sem comprar ha mais do que isto (em dias), o cliente e "Inativo". */
export const INACTIVE_AFTER_DAYS = 120;
/** Sugestao de recontato: ultima compra entre estes dois limites (em dias). */
export const REPURCHASE_MIN_DAYS = 60;
export const REPURCHASE_MAX_DAYS = 180;
/** Janela do card "Clientes recorrentes" do painel. */
export const RECENT_BUYERS_DAYS = 30;

const UM_DIA_MS = 24 * 60 * 60 * 1_000;

// ---------------------------------------------------------------------------
// Chave do cliente
// ---------------------------------------------------------------------------

/**
 * Telefone em digitos sem o DDI 55.
 *
 * O mesmo cliente aparece ora como "(34) 99999-9999" (pedido do site), ora como
 * "5534999999999" (WhatsApp). Tirar o 55 so quando sobra um numero nacional
 * completo (12 ou 13 digitos) evita cortar o DDD 55 do Rio Grande do Sul.
 */
export function phoneKey(phone: string): string {
  const digits = onlyDigits(phone);
  return digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
}

interface Identidade {
  /** Telefone com DDD, sem o 55 (10 ou 11 digitos). */
  phone: string | null;
  /** CPF (11) ou CNPJ (14) em digitos. */
  document: string | null;
}

function identidade(customer: { phone?: string | null; cpf?: string | null }): Identidade {
  const telefone = phoneKey(customer.phone ?? "");
  const documento = onlyDigits(customer.cpf ?? "");
  return {
    phone: telefone.length >= 10 && telefone.length <= 11 ? telefone : null,
    document: documento.length === 11 || documento.length === 14 ? documento : null,
  };
}

/**
 * As formas de reconhecer o cliente: telefone com DDD e/ou CPF/CNPJ, nessa
 * ordem. Lista vazia = nao ha como saber quem e.
 */
export function customerIdentities(customer: { phone?: string | null; cpf?: string | null }): string[] {
  const { phone, document } = identidade(customer);
  return [phone, document].filter((valor, indice, lista): valor is string => Boolean(valor) && lista.indexOf(valor) === indice);
}

/**
 * Chave do cliente: telefone quando ha um numero com DDD, senao CPF/CNPJ.
 *
 * Telefone vem primeiro porque e o que existe nos dois lados — o atendimento
 * do WhatsApp tem telefone e nunca tem CPF. Sem nenhum dos dois (lancamento do
 * grupo, que so traz o primeiro nome) a chave e `null`: agrupar por nome
 * juntaria clientes diferentes com o mesmo "Lucas".
 */
export function customerKey(customer: { phone?: string | null; cpf?: string | null }): string | null {
  return customerIdentities(customer)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Quem e quem: telefone e CPF do mesmo cliente viram um cliente so
// ---------------------------------------------------------------------------

type PedidoIdentificavel = Pick<SalesOrderRecord, "number" | "customer" | "customer_key" | "status" | "created_at">;

export interface CustomerIndex {
  /** Chave canonica do cliente que tem esta identidade (telefone sem 55 ou CPF/CNPJ), ou `null`. */
  keyOf(identity: string | null | undefined): string | null;
  /** Chave canonica do cliente do pedido; `null` para pedido sem telefone nem CPF. */
  keyOfOrder(order: Pick<SalesOrderRecord, "customer" | "customer_key">): string | null;
  /** Chave canonica do cliente dono do pedido com este numero (DG-…). */
  keyOfOrderNumber(orderNumber: string | null | undefined): string | null;
  /**
   * Numero do pedido mais recente do cliente (de qualquer status). E o que os
   * links entre as telas levam na URL para apontar o cliente: um numero de
   * pedido nao diz nada de quem comprou, ao contrario do telefone ou do CPF, que
   * ficariam no historico do navegador e nos registros de acesso da hospedagem.
   */
  referenceOf(identity: string | null | undefined): string | null;
  /** Todos os telefones e CPF/CNPJ do cliente, inclusive os antigos. */
  identitiesOf(identity: string | null | undefined): string[];
  /** Compras finalizadas do cliente (pela chave canonica ou qualquer identidade dele). */
  completedOrders(identity: string | null | undefined): number;
  /** Compras finalizadas do cliente feitas ANTES do instante `iso`. */
  completedBefore(identity: string | null | undefined, iso: string): number;
}

interface IdentidadesDoPedido {
  /**
   * Quem o pedido e. O CPF/CNPJ vem primeiro porque e de uma pessoa so; o
   * telefone pode ser dividido (a mae que empresta o celular ao filho). Sem
   * documento, o telefone; sem os dois, a chave gravada.
   */
  ancora: string | null;
  phone: string | null;
  document: string | null;
  /** Chave gravada no pedido (bloco D) que nao bate com o retrato do cliente. */
  gravada: string | null;
}

function identidadesDoPedido(order: Pick<SalesOrderRecord, "customer" | "customer_key">): IdentidadesDoPedido {
  const { phone, document } = identidade(order.customer ?? {});
  const chave = order.customer_key?.trim() || null;
  const gravada = chave && chave !== phone && chave !== document ? chave : null;
  return { ancora: document ?? phone ?? gravada, phone, document, gravada };
}

/**
 * Agrupa as identidades que aparecem juntas em algum pedido.
 *
 * A chave gravada no pedido e o telefone quando existe, senao o CPF. Sem este
 * passo, o cliente que comprou uma vez pelo site (telefone + CPF) e outra no
 * painel sem informar telefone (so CPF) viraria dois clientes de uma compra
 * cada — justamente o recorrente que a tela quer mostrar. Qualquer pedido,
 * inclusive pendente ou cancelado, prova que o telefone e o CPF sao da mesma
 * pessoa; so a CONTAGEM de compras olha os finalizados.
 *
 * Dois CPF/CNPJ diferentes nunca viram um cliente so, nem por um telefone em
 * comum: juntar mae e filho que usaram o mesmo celular misturaria as compras e
 * poria a compra de um na mensagem de recontato enviada ao outro. O telefone
 * dividido fica com quem o usou primeiro, e cada pedido com documento pertence
 * ao dono do documento.
 *
 * A chave canonica do grupo e o telefone do pedido mais recente que trouxe um
 * telefone DO GRUPO (o numero que o atendente vai chamar), senao o CPF/CNPJ.
 */
export function buildCustomerIndex(orders: ReadonlyArray<PedidoIdentificavel>): CustomerIndex {
  const pai = new Map<string, string>();
  const raiz = (id: string): string => {
    if (!pai.has(id)) pai.set(id, id);
    let topo = id;
    for (let acima = pai.get(topo) ?? topo; acima !== topo; acima = pai.get(topo) ?? topo) topo = acima;
    // Encurta o caminho para as proximas buscas.
    for (let atual = id; atual !== topo;) {
      const acima = pai.get(atual) ?? topo;
      pai.set(atual, topo);
      atual = acima;
    }
    return topo;
  };

  // Documento de cada grupo (pela raiz). Um grupo tem no maximo um.
  const documentoDaRaiz = new Map<string, string>();
  const unir = (base: string, outra: string): void => {
    const a = raiz(base);
    const b = raiz(outra);
    if (a === b) return;
    const docA = documentoDaRaiz.get(a);
    const docB = documentoDaRaiz.get(b);
    if (docA && docB && docA !== docB) return;
    pai.set(b, a);
    if (!docA && docB) documentoDaRaiz.set(a, docB);
    documentoDaRaiz.delete(b);
  };

  // Do mais antigo para o mais recente: quem usou o telefone primeiro fica com ele.
  const antigosPrimeiro = [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const order of antigosPrimeiro) {
    const { ancora, phone, document, gravada } = identidadesDoPedido(order);
    if (!ancora) continue;
    const base = raiz(ancora);
    if (document && !documentoDaRaiz.has(base)) documentoDaRaiz.set(base, document);
    if (phone && phone !== ancora) unir(ancora, phone);
    if (gravada && gravada !== ancora) unir(ancora, gravada);
  }

  const telefoneDoGrupo = new Map<string, string>();
  const ancoraDoGrupo = new Map<string, string>();
  const numeroDoGrupo = new Map<string, string>();
  const grupoDoNumero = new Map<string, string>();
  for (const order of [...antigosPrimeiro].reverse()) {
    const { ancora, phone } = identidadesDoPedido(order);
    if (!ancora) continue;
    const grupo = raiz(ancora);
    // Telefone recusado na uniao (e de outro cliente) nao vira o numero deste.
    if (phone && raiz(phone) === grupo && !telefoneDoGrupo.has(grupo)) telefoneDoGrupo.set(grupo, phone);
    if (!ancoraDoGrupo.has(grupo)) ancoraDoGrupo.set(grupo, ancora);
    if (!numeroDoGrupo.has(grupo)) numeroDoGrupo.set(grupo, order.number);
    grupoDoNumero.set(order.number, grupo);
  }
  const canonica = (grupo: string): string => telefoneDoGrupo.get(grupo) ?? documentoDaRaiz.get(grupo) ?? ancoraDoGrupo.get(grupo) ?? grupo;

  // Instantes das compras finalizadas de cada cliente, em ordem.
  const compras = new Map<string, number[]>();
  for (const order of antigosPrimeiro) {
    if (order.status !== "completed") continue;
    const { ancora } = identidadesDoPedido(order);
    if (!ancora) continue;
    const chave = canonica(raiz(ancora));
    const instante = Date.parse(order.created_at);
    const lista = compras.get(chave);
    if (lista) lista.push(instante);
    else compras.set(chave, [instante]);
  }

  const identidades = new Map<string, string[]>();
  for (const id of [...pai.keys()]) {
    const chave = canonica(raiz(id));
    const lista = identidades.get(chave);
    if (lista) lista.push(id);
    else identidades.set(chave, [id]);
  }

  const keyOf = (identity: string | null | undefined): string | null => {
    const id = identity?.trim() ?? "";
    return id && pai.has(id) ? canonica(raiz(id)) : null;
  };

  return {
    keyOf,
    keyOfOrder: (order) => keyOf(identidadesDoPedido(order).ancora),
    keyOfOrderNumber: (orderNumber) => {
      const grupo = grupoDoNumero.get(orderNumber?.trim() ?? "");
      return grupo ? canonica(grupo) : null;
    },
    referenceOf: (identity) => {
      const id = identity?.trim() ?? "";
      return id && pai.has(id) ? numeroDoGrupo.get(raiz(id)) ?? null : null;
    },
    identitiesOf: (identity) => [...(identidades.get(keyOf(identity) ?? "") ?? [])],
    completedOrders: (identity) => compras.get(keyOf(identity) ?? "")?.length ?? 0,
    completedBefore: (identity, iso) => {
      const limite = Date.parse(iso);
      return (compras.get(keyOf(identity) ?? "") ?? []).filter((instante) => instante < limite).length;
    },
  };
}

/**
 * "Este telefone/CPF ja comprou N vezes" do Novo pedido, com a referencia do
 * cliente para o link do historico. Telefone e CPF sao conferidos separados:
 * cada um pode ja ser conhecido, e de clientes diferentes.
 */
export function lookupCustomerPurchases(index: CustomerIndex, customer: { phone?: string | null; cpf?: string | null }): CustomerPurchaseLookup {
  const telefone = customerIdentities({ phone: customer.phone })[0] ?? null;
  const documento = customerIdentities({ cpf: customer.cpf })[0] ?? null;
  const phonePurchases = index.completedOrders(telefone);
  const documentPurchases = index.completedOrders(documento);
  return {
    phonePurchases,
    documentPurchases,
    reference: index.referenceOf(phonePurchases ? telefone : documentPurchases ? documento : null),
  };
}

// ---------------------------------------------------------------------------
// Retrato de cada cliente
// ---------------------------------------------------------------------------

/**
 * Inativo vence os outros: quem sumiu ha mais de 120 dias precisa de
 * recontato, seja VIP ou nao — a tabela continua mostrando compras e total para
 * dizer o tamanho do cliente.
 */
export function customerSegment(customer: Pick<CustomerSummary, "ordersCount" | "totalCents" | "daysSinceLastOrder">): CustomerSegment {
  if (customer.daysSinceLastOrder > INACTIVE_AFTER_DAYS) return "inactive";
  if (customer.ordersCount >= VIP_MIN_ORDERS || customer.totalCents >= VIP_MIN_TOTAL_CENTS) return "vip";
  if (customer.ordersCount >= RETURNING_MIN_ORDERS) return "returning";
  return "new";
}

/**
 * Agrupa as compras FINALIZADAS por cliente.
 *
 * Pedido pendente ainda pode nao acontecer e cancelado nao aconteceu: nenhum
 * dos dois conta como compra (mas ajudam a juntar telefone e CPF do mesmo
 * cliente). Compra sem telefone nem CPF fica fora e e contada a parte.
 *
 * `leads` so precisa da chave e da etapa: conta os atendimentos em aberto de
 * cada cliente, para ninguem recontatar quem ja esta sendo atendido.
 */
export function customerSummaries(
  orders: readonly SalesOrderRecord[],
  leads: ReadonlyArray<Pick<LeadRecord, "customer_key" | "stage">> = [],
  now: Date = new Date(),
  indice: CustomerIndex = buildCustomerIndex(orders),
): CustomerBook {
  const porCliente = new Map<string, SalesOrderRecord[]>();
  let unidentifiedOrders = 0;
  let unidentifiedTotalCents = 0;

  for (const order of orders) {
    if (order.status !== "completed") continue;
    const chave = indice.keyOfOrder(order);
    if (!chave) {
      unidentifiedOrders += 1;
      unidentifiedTotalCents += order.total_cents;
      continue;
    }
    const lista = porCliente.get(chave);
    if (lista) lista.push(order);
    else porCliente.set(chave, [order]);
  }

  const abertos = new Map<string, number>();
  for (const lead of leads) {
    if (!OPEN_LEAD_STAGES.includes(lead.stage)) continue;
    const chave = indice.keyOf(lead.customer_key);
    if (chave) abertos.set(chave, (abertos.get(chave) ?? 0) + 1);
  }

  const hoje = diaLocal(now.toISOString());
  const customers = [...porCliente].map(([key, pedidos]) => resumir(key, pedidos, abertos.get(key) ?? 0, hoje, indice));
  customers.sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt));
  return { customers, unidentifiedOrders, unidentifiedTotalCents };
}

function resumir(key: string, pedidos: SalesOrderRecord[], openLeads: number, hoje: string, indice: CustomerIndex): CustomerSummary {
  const recentes = [...pedidos].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const ultimo = recentes[0];
  const primeiro = recentes[recentes.length - 1];
  const nome = recentes.find((order) => order.customer?.name?.trim())?.customer.name.trim() ?? "";
  // Telefone e documento DESTE cliente: um pedido pode trazer o telefone de
  // outra pessoa (celular emprestado), que ficou com o dono dele no indice.
  const doCliente = (valor: string | null): valor is string => Boolean(valor) && indice.keyOf(valor) === key;
  const telefone = recentes.map((order) => identidade(order.customer ?? {}).phone).find(doCliente) ?? "";
  const documento = recentes.map((order) => identidade(order.customer ?? {}).document).find(doCliente) ?? "";
  const totalCents = pedidos.reduce((soma, order) => soma + order.total_cents, 0);
  const diaDaUltima = diaLocal(ultimo.created_at);
  const daysSinceLastOrder = diasEntre(diaDaUltima, hoje);
  const resumo = {
    key,
    identities: indice.identitiesOf(key),
    name: nome,
    phone: telefone,
    cpf: documento,
    ordersCount: pedidos.length,
    totalCents,
    firstOrderAt: primeiro.created_at,
    lastOrderAt: ultimo.created_at,
    daysSinceLastOrder,
    avgDaysBetween: pedidos.length > 1 ? Math.round(diasEntre(diaLocal(primeiro.created_at), diaDaUltima) / (pedidos.length - 1)) : null,
    openLeads,
    lastOrderNumber: ultimo.number,
    lastProducts: ultimo.items.map((item) => (item.variant ? `${item.product_name} (${item.variant})` : item.product_name)),
  };
  return { ...resumo, segment: customerSegment(resumo) };
}

/**
 * Clientes para chamar de volta: ultima compra entre 60 e 180 dias atras.
 *
 * Antes de 60 dias a compra ainda e recente; depois de 180 o contato ja esfriou
 * demais para uma mensagem de "tudo certo com a sua compra?". Os que mais
 * gastaram vem primeiro. Nada e enviado sozinho: a tela so abre o WhatsApp com
 * a mensagem pronta.
 */
export function repurchaseSuggestions(customers: readonly CustomerSummary[]): CustomerSummary[] {
  return customers
    .filter((customer) => customer.daysSinceLastOrder >= REPURCHASE_MIN_DAYS && customer.daysSinceLastOrder <= REPURCHASE_MAX_DAYS)
    .sort((a, b) => b.totalCents - a.totalCents || a.daysSinceLastOrder - b.daysSinceLastOrder);
}

/**
 * Quem comprou nos ultimos `days` dias e, destes, quantos ja tinham comprado
 * antes (2 compras ou mais) — o card "Clientes recorrentes" do painel.
 */
export function recentBuyers(customers: readonly CustomerSummary[], days = RECENT_BUYERS_DAYS): { buyers: number; returning: number } {
  const recentes = customers.filter((customer) => customer.daysSinceLastOrder <= days);
  return { buyers: recentes.length, returning: recentes.filter((customer) => customer.ordersCount >= RETURNING_MIN_ORDERS).length };
}

/**
 * Etiqueta de recorrencia de um pedido ou atendimento.
 *
 * Quem decide e `previousPurchases`: as compras finalizadas do cliente feitas
 * ANTES do registro (`completedBefore`). A primeira compra de alguem continua
 * "Cliente novo" mesmo depois que ele voltou; recorrente e o pedido da volta.
 * O numero do rotulo e o total de compras do cliente hoje (`totalPurchases`),
 * o mesmo da tela de Clientes, para onde a etiqueta leva.
 */
export function recurrenceBadge(previousPurchases: number, totalPurchases: number): { returning: boolean; label: string } {
  if (previousPurchases < 1) return { returning: false, label: "Cliente novo" };
  const total = Math.max(totalPurchases, previousPurchases);
  return { returning: true, label: `Recorrente (${total} ${total === 1 ? "compra" : "compras"})` };
}

/**
 * Busca da tela de Clientes: nome (sem acento) ou os digitos de QUALQUER
 * telefone ou CPF/CNPJ do cliente, com ou sem o 55 e a pontuacao — quem trocou
 * de numero continua achavel pelo antigo.
 */
export function customerMatches(customer: Pick<CustomerSummary, "name" | "identities">, query: string): boolean {
  const termo = normalize(query);
  if (!termo) return true;
  if (normalize(customer.name).includes(termo)) return true;
  const digitos = onlyDigits(query);
  if (digitos.length < 4) return false;
  const telefone = phoneKey(digitos);
  return customer.identities.some((id) => id.includes(telefone) || id.includes(digitos));
}

// ---------------------------------------------------------------------------
// Datas no fuso da loja
// ---------------------------------------------------------------------------

/** Dia YYYY-MM-DD em America/Sao_Paulo — o fuso em que a loja trabalha. */
function diaLocal(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** Dias de calendario entre dois dias YYYY-MM-DD (meia-noite UTC dos dois: a diferenca e exata). */
function diasEntre(de: string, ate: string): number {
  return Math.max(0, Math.round((Date.parse(ate) - Date.parse(de)) / UM_DIA_MS));
}
