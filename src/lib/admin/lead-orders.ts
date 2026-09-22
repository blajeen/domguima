import "server-only";

import { formatPrice } from "@/lib/utils/format";
import { readCatalogState, type CatalogState } from "./catalog-store";
import { defaultStoreSettings } from "./defaults";
import { distributionCandidates, eligibleAttendants } from "./distribution";
import { createLead, deleteLeads, findLead, findLeadByOrder, findLeadsByOrders, updateLead, type LeadPatch } from "./leads";
import { assignPendingSalesOrder } from "./orders";
import { normalizeLeadDistributionMode } from "./sellers";
import {
  LEAD_LOST_REASON_LABELS,
  LEAD_STAGE_LABELS,
  UNASSIGNED_ORDER_SELLER_ID,
  type LeadRecord,
  type SalesOrderRecord,
  type SellerRecord,
} from "./types";

/**
 * ATENDIMENTO ↔ PEDIDO
 * ====================
 *
 * O pedido do checkout do site nasce junto com um atendimento (kind
 * `site_checkout`, `order_id` apontando para ele) e os dois andam juntos:
 * quem cuida de um cuida do outro, e o desfecho do pedido fecha o atendimento.
 *
 * TUDO AQUI E BEST-EFFORT. O pedido e a operacao principal — cliente
 * finalizando compra, dono confirmando venda, estoque baixando. Uma falha no CRM
 * (tabela ainda nao criada, rede, RPC) vira `console.warn` e nunca desfaz nem
 * bloqueia o pedido. Por isso nenhuma funcao deste modulo lanca erro.
 */

/** Quem aparece como autor do que o site faz sozinho, igual ao `created_by` dos pedidos. */
const SITE_ACTOR = "public-site";

/**
 * Cria o atendimento de um pedido recem-chegado do checkout e, quando a loja
 * distribui sozinha, entrega o pedido ao atendente sorteado.
 *
 * No modo "cliente escolhe" o checkout completo nao pergunta com quem o cliente
 * quer falar: o atendimento nasce na fila livre e o pedido fica "Fila livre"
 * ate alguem puxar. Nos modos automaticos a RPC escolhe (com a mesma trava do
 * clique no WhatsApp) e o pedido recebe o mesmo atendente.
 *
 * O `visitor_id` NAO vai para a RPC de proposito: o dedupe de 90s por
 * visitante juntaria dois pedidos DIFERENTES do mesmo navegador num atendimento
 * so, e o segundo pedido ficaria sem atendimento. Aqui a chave de repeticao e o
 * proprio pedido (`findLeadByOrder`), que cobre o reenvio do mesmo request_id.
 *
 * `state` e o catalogo lido para validar o pedido: dele saem atendentes e modo.
 */
export async function registerSiteOrderLead(state: CatalogState, order: SalesOrderRecord, attribution: Record<string, string>): Promise<void> {
  try {
    // Reenvio do mesmo pedido: o atendimento dele ja existe.
    if (await findLeadByOrder(order.id)) return;

    const settings = { ...defaultStoreSettings, ...state.settings };
    const modo = normalizeLeadDistributionMode(settings.leadDistributionMode);
    const elegiveis = eligibleAttendants(state.operations.sellers, settings);
    const automatico = (modo === "round_robin" || modo === "least_busy") && elegiveis.length > 0;

    const { lead } = await createLead(
      {
        kind: "site_checkout",
        orderId: order.id,
        customerName: order.customer.name,
        customerPhone: order.customer.phone,
        items: order.items.map((item) => ({
          product_id: item.product_id,
          product_name: item.variant ? `${item.product_name} (${item.variant})` : item.product_name,
          quantity: item.quantity,
        })),
        message: [
          `Pedido ${order.number} pelo site · ${formatPrice(order.total_cents)}`,
          order.notes ? `Observação do cliente: ${order.notes}` : "",
        ].filter(Boolean).join("\n"),
        pagePath: "/checkout",
        // Mesma regra da rota do WhatsApp: a classificacao da origem entra com o
        // controle de trafego; o que houver no cookie ja viaja em `attribution`.
        source: "direct",
        attribution,
        createdBy: SITE_ACTOR,
      },
      {
        candidates: automatico ? distributionCandidates(elegiveis) : [],
        mode: automatico ? modo : "customer_choice",
      },
    );

    if (!lead?.seller_id) return;
    // So um pedido ainda sem dono recebe o atendente sorteado: nunca passar por
    // cima de uma escolha feita no painel.
    if (order.status !== "pending" || order.seller_id !== UNASSIGNED_ORDER_SELLER_ID) return;
    const seller = state.operations.sellers.find((item) => item.id === lead.seller_id);
    if (!seller) return;
    await assignPendingSalesOrder(order, seller, SITE_ACTOR);
  } catch (error) {
    console.warn(`Nao foi possivel registrar o atendimento do pedido ${order.number}; o pedido segue na fila livre.`, error);
  }
}

/**
 * O cliente abriu o WhatsApp na tela "Solicitação recebida" com o pedido ainda
 * na fila livre (loja em "cliente escolhe") e escolheu com quem falar: essa
 * pessoa assume o atendimento do pedido e o proprio pedido.
 *
 * Sem isto a conversa virava um SEGUNDO atendimento, enquanto o do pedido
 * continuava na fila livre e o pedido sem dono — com o cliente ja falando com
 * alguem. Como nos demais cliques do site, o atendimento nao grava auditoria;
 * a troca do pedido fica no historico como "Pedido atribuído" pelo site.
 *
 * Mesma regra do rodizio no checkout: so um pedido ainda pendente e sem dono
 * muda. O que alguem ja definiu no painel nunca e sobrescrito pelo site.
 */
export async function assignOrderLeadFromSite(lead: LeadRecord, seller: SellerRecord, assignedBy: "customer" | "site"): Promise<void> {
  if (!lead.order_id) return;
  try {
    const { lead: atualizado } = await updateLead(lead.id, { seller_id: seller.id, assigned_by: assignedBy });
    if (!atualizado) return;
    const order = (await readCatalogState(true)).operations.orders.find((item) => item.id === lead.order_id);
    if (!order || order.status !== "pending" || order.seller_id !== UNASSIGNED_ORDER_SELLER_ID) return;
    await assignPendingSalesOrder(order, seller, SITE_ACTOR);
  } catch (error) {
    console.warn(`Nao foi possivel entregar o atendimento ${lead.id} a quem o cliente escolheu.`, error);
  }
}

/**
 * Por que o atendimento NAO pode mudar de atendente, ou `null` se pode.
 *
 * Atendimento de pedido ja confirmado ou cancelado fica com quem cuidou do
 * pedido: na confirmacao o vendedor passou a responder pela comissao, e o
 * pedido nao acompanha mais a troca (ver `assignOrderOfLead`). Transferir so o
 * atendimento faria "ganhos por atendente" divergir da comissao.
 *
 * Best-effort como o resto do modulo: se a checagem falhar, a redistribuicao
 * segue como antes.
 */
export async function orderLockForLead(leadId: string): Promise<string | null> {
  try {
    const lead = await findLead(leadId);
    if (!lead?.order_id) return null;
    const order = (await readCatalogState(true)).operations.orders.find((item) => item.id === lead.order_id);
    if (!order || order.status === "pending") return null;
    return order.status === "completed"
      ? `O pedido ${order.number} deste atendimento já foi confirmado com ${order.seller_name}: o vendedor ficou definido na confirmação.`
      : `O pedido ${order.number} deste atendimento já foi cancelado: o atendimento fica com quem cuidou do pedido.`;
  } catch (error) {
    console.warn(`Nao foi possivel conferir o pedido do atendimento ${leadId}.`, error);
    return null;
  }
}

/**
 * O pedido pendente mudou de atendente no painel: o atendimento dele vai junto.
 * Sem isso a tela de Atendimento continuaria mostrando o pedido na fila livre
 * (ou com a pessoa anterior) depois de o dono ja ter definido quem cuida.
 */
export async function assignLeadOfOrder(orderId: string, seller: SellerRecord | null, actorId: string): Promise<void> {
  try {
    const lead = await findLeadByOrder(orderId);
    if (!lead || (lead.seller_id ?? null) === (seller?.id ?? null)) return;
    await updateLead(
      lead.id,
      { seller_id: seller?.id ?? null, assigned_by: actorId },
      { actor_id: actorId, action: "lead.assigned", after_data: { atendente: seller?.name ?? "Fila livre", motivo: "Pedido redistribuído" } },
    );
  } catch (error) {
    console.warn(`Nao foi possivel acompanhar o atendimento do pedido ${orderId}.`, error);
  }
}

/**
 * O caminho inverso: o atendimento foi puxado, transferido ou devolvido a fila
 * na tela de Atendimento e tem um pedido do site ainda pendente — o pedido
 * passa a ser da mesma pessoa. Pedido ja confirmado ou cancelado nao muda: ali
 * o vendedor ficou definido na confirmacao e responde pela comissao.
 */
export async function assignOrderOfLead(lead: LeadRecord, seller: SellerRecord | null, actorId: string): Promise<void> {
  if (!lead.order_id) return;
  try {
    const order = (await readCatalogState(true)).operations.orders.find((item) => item.id === lead.order_id);
    if (!order || order.status !== "pending") return;
    await assignPendingSalesOrder(order, seller, actorId);
  } catch (error) {
    console.warn(`Nao foi possivel acompanhar o pedido do atendimento ${lead.id}.`, error);
  }
}

export type OrderOutcome =
  /** Pedido confirmado: o atendimento vira "Ganho" com quem confirmou a venda. */
  | { stage: "won"; seller: Pick<SellerRecord, "id" | "name"> | null }
  /** Pedido cancelado ou excluido: "Perdido", motivo "Outro", com a nota explicando. */
  | { stage: "lost"; note: string };

/**
 * Fecha os atendimentos vinculados aos pedidos que acabaram de ser confirmados
 * ou cancelados.
 *
 * Repetir o desfecho nao muda nada: confirmar de novo nao reescreve o
 * atendimento ganho, e a mesma nota nunca entra duas vezes. Cada atendimento e
 * atualizado isoladamente: um que falha nao impede os outros.
 */
export async function closeLeadsOfOrders(orders: ReadonlyArray<Pick<SalesOrderRecord, "id" | "number">>, outcome: OrderOutcome, actorId: string): Promise<void> {
  if (!orders.length) return;
  try {
    await fecharAtendimentos(await findLeadsByOrders(orders.map((order) => order.id)), orders, outcome, actorId);
  } catch (error) {
    console.warn("Nao foi possivel fechar os atendimentos dos pedidos.", error);
  }
}

/**
 * Pedidos excluidos em definitivo.
 *
 * O atendimento que NASCEU do pedido (checkout do site) e uma copia dele —
 * nome, telefone, itens e a observacao que o cliente escreveu — e sai junto:
 * "excluir" promete que o pedido some, e o pedido de eliminacao de dados do
 * cliente (LGPD) chega ao dono justamente por esse caminho. Mante-lo como
 * "perdido" deixava os dados no painel, com link de WhatsApp para o cliente.
 *
 * Atendimento que existia antes e so foi vinculado ao pedido (uma conversa que
 * virou venda) e registro proprio: continua, fechado como perdido com a nota.
 *
 * Devolve quantos atendimentos foram apagados, para o historico da exclusao.
 */
export async function discardLeadsOfDeletedOrders(orders: ReadonlyArray<Pick<SalesOrderRecord, "id" | "number">>, actorId: string): Promise<number> {
  if (!orders.length) return 0;
  try {
    const leads = await findLeadsByOrders(orders.map((order) => order.id));
    const copias = leads.filter((lead) => lead.kind === "site_checkout");
    const apagados = await deleteLeads(copias.map((lead) => lead.id));
    await fecharAtendimentos(
      leads.filter((lead) => lead.kind !== "site_checkout"),
      orders,
      { stage: "lost", note: "Pedido excluído" },
      actorId,
    );
    return apagados;
  } catch (error) {
    console.warn("Nao foi possivel tratar os atendimentos dos pedidos excluidos.", error);
    return 0;
  }
}

async function fecharAtendimentos(
  leads: readonly LeadRecord[],
  orders: ReadonlyArray<Pick<SalesOrderRecord, "id" | "number">>,
  outcome: OrderOutcome,
  actorId: string,
): Promise<void> {
  const numeros = new Map(orders.map((order) => [order.id, order.number]));
  for (const lead of leads) {
    const patch = patchDeFechamento(lead, outcome, actorId);
    if (!patch) continue;
    try {
      await updateLead(lead.id, patch, {
        actor_id: actorId,
        action: "lead.stage_changed",
        after_data: {
          etapa: LEAD_STAGE_LABELS[outcome.stage],
          pedido: numeros.get(lead.order_id ?? "") ?? lead.order_id,
          ...(outcome.stage === "lost" ? { motivo: LEAD_LOST_REASON_LABELS.other, nota: outcome.note } : {}),
        },
      });
    } catch (error) {
      console.warn(`Nao foi possivel fechar o atendimento ${lead.id}.`, error);
    }
  }
}

function patchDeFechamento(lead: LeadRecord, outcome: OrderOutcome, actorId: string): LeadPatch | null {
  if (outcome.stage === "won") {
    const vendedor = outcome.seller;
    const trocaAtendente = vendedor !== null && lead.seller_id !== vendedor.id;
    if (lead.stage === "won" && !trocaAtendente) return null;
    // O vendedor escolhido na confirmacao passa a responder pelo atendimento —
    // o mesmo que o pedido grava para a comissao.
    return vendedor && trocaAtendente
      ? { stage: "won", seller_id: vendedor.id, assigned_by: actorId }
      : { stage: "won" };
  }
  // A nota diz o que aconteceu com o pedido. Ja anotada, nao repete (cancelar
  // de novo, ou excluir o que ja foi cancelado com a mesma nota).
  const jaAnotado = lead.notes.includes(outcome.note);
  const notes = jaAnotado ? lead.notes : (lead.notes ? `${lead.notes} · ${outcome.note}` : outcome.note).slice(0, 1_000);
  // Ja perdido (por exemplo, pedido cancelado e depois excluido): a etapa e o
  // motivo escolhidos antes ficam; so a nota nova entra.
  if (lead.stage === "lost") return jaAnotado ? null : { notes };
  return { stage: "lost", lost_reason: "other", notes };
}
