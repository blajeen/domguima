"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ownerOrThrow } from "@/lib/admin/auth";
import { mutateCatalogState, readCatalogState, type CatalogState } from "@/lib/admin/catalog-store";
import { customerKey, phoneKey } from "@/lib/admin/customers";
import { findLead } from "@/lib/admin/leads";
import { PAYMENT_STATUS_LABELS, DELIVERY_STATUS_LABELS, type CrmWorkflowEntry } from "@/lib/admin/crm-workflow-types";
import { hasSupabaseConfig } from "@/lib/admin/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isValidDocument, onlyDigits } from "@/lib/utils/validators";
import type { ActionState } from "@/lib/admin/types";

function audit(state: CatalogState, actor: string, action: string, id: string, before: unknown, after: Record<string, unknown>) {
  state.auditLogs.unshift({ id: randomUUID(), actor_id: actor, action, entity_type: action.split(".")[0], entity_id: id, before_data: before, after_data: after, created_at: new Date().toISOString() });
  state.auditLogs = state.auditLogs.slice(0, 1000);
}
function refresh() { for (const path of ["/painel", "/painel/pedidos", "/painel/atendimento", "/painel/clientes", "/painel/financeiro", "/painel/historico"]) revalidatePath(path); }

export async function saveCrmWorkflowAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const id = String(formData.get("entityId") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  if (!id || id.length > 120 || !["order", "lead", "customer"].includes(kind)) return { message: "Registro inválido." };
  const change: Partial<CrmWorkflowEntry> = {};
  if (kind === "order") {
    const payment = String(formData.get("payment") ?? "");
    const delivery = String(formData.get("delivery") ?? "");
    if (!Object.hasOwn(PAYMENT_STATUS_LABELS, payment) || !Object.hasOwn(DELIVERY_STATUS_LABELS, delivery)) return { message: "Escolha situações válidas." };
    change.payment_status = payment as CrmWorkflowEntry["payment_status"];
    change.delivery_status = delivery as CrmWorkflowEntry["delivery_status"];
  } else if (kind === "lead") {
    const raw = String(formData.get("nextContact") ?? "");
    // Input uses the store timezone, independently of the operator's computer.
    if (raw && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) || !Number.isFinite(Date.parse(`${raw}:00-03:00`)))) return { message: "Informe uma data e hora válidas." };
    if (raw && new Date(Date.parse(`${raw}:00-03:00`) - 3 * 3600_000).toISOString().slice(0, 16) !== raw) return { message: "Informe uma data existente no calendário." };
    change.next_contact_at = raw ? new Date(`${raw}:00-03:00`).toISOString() : null;
    if (!await findLead(id)) return { message: "Atendimento não encontrado." };
  } else change.last_contact_at = new Date().toISOString();
  try {
    await mutateCatalogState(state => {
      if (kind === "order" && !state.operations.orders.some(order => order.id === id)) throw new Error("Registro não encontrado.");
      if (kind === "customer") {
        const order = state.operations.orders.find(order => order.number === id && order.status === "completed");
        if (!order || !customerKey(order.customer)) throw new Error("Cliente não encontrado.");
      }
      const key = `${kind}:${id}`;
      const notes = state.operations.crm_workflow ??= {};
      const before = notes[key];
      notes[key] = { ...before, ...change, updated_at: new Date().toISOString(), updated_by: owner.id };
      audit(state, owner.id, kind === "customer" ? "customer.contacted" : kind === "lead" ? "lead.followup_scheduled" : "order.workflow_updated", id, before ?? null, { ...change });
    }, { privateOnly: true });
    refresh();
    return { ok: true, message: kind === "customer" ? "Recontato registrado. Nenhuma mensagem foi enviada pelo site." : "Acompanhamento salvo." };
  } catch { return { message: "Não foi possível salvar agora. Tente novamente." }; }
}

const identification = z.object({
  orderId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(3).max(140),
  phone: z.string().max(30).transform(phoneKey).refine(value => !value || value.length === 10 || value.length === 11, "Telefone precisa ter DDD e 10 ou 11 dígitos."),
  document: z.string().max(30).transform(onlyDigits).refine(value => !value || isValidDocument(value), "CPF/CNPJ inválido."),
}).refine(value => Boolean(value.phone || value.document), "Informe telefone ou CPF/CNPJ para reconhecer o cliente.");

export async function identifyOrderCustomerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const parsed = identification.safeParse(Object.fromEntries(["orderId", "name", "phone", "document"].map(key => [key, String(formData.get(key) ?? "")])));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Revise os dados." };
  const value = parsed.data;
  try {
    const state = await readCatalogState(true);
    const order = state.operations.orders.find(item => item.id === value.orderId);
    if (!order) return { message: "Pedido não encontrado." };
    // Never replace an existing identity through the import-correction form.
    if (customerKey(order.customer) || order.customer_key) return { message: "Este pedido já tem identificação. Atualize a página para conferir." };
    const customer = { ...order.customer, name: value.name, phone: value.phone, cpf: value.document };
    if (hasSupabaseConfig()) {
      const { data, error } = await createSupabaseAdminClient().from("sales_orders").update({ customer, customer_key: customerKey(customer) }).eq("id", order.id).eq("customer", JSON.stringify(order.customer)).select("id");
      if (error || !data?.length) return { message: "O pedido mudou ou não pôde ser salvo. Atualize a página e tente novamente." };
    }
    await mutateCatalogState(current => {
      if (!hasSupabaseConfig()) {
        const found = current.operations.orders.find(item => item.id === order.id);
        if (!found || customerKey(found.customer) || found.customer_key) throw new Error("Pedido alterado.");
        found.customer = customer;
        found.customer_key = customerKey(customer);
      }
      audit(current, owner.id, "order.customer_identified", order.id, null, { pedido: order.number, identificacao: value.phone ? "telefone" : "CPF/CNPJ" });
    }, { privateOnly: true });
    refresh();
    return { ok: true, message: "Cliente identificado. O pedido passa a contar no histórico de compras dele." };
  } catch { return { message: "Não foi possível identificar agora. Tente novamente." }; }
}
