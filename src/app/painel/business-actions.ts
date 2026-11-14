"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ownerOrThrow } from "@/lib/admin/auth";
import { mutateCatalogState } from "@/lib/admin/catalog-store";
import { emptyBusinessSettings, validMoney } from "@/lib/admin/business-insights";
import { moneyToCents } from "@/lib/admin/validation";
import type { ActionState } from "@/lib/admin/types";

function money(value: FormDataEntryValue | null) {
  const result = moneyToCents(value);
  if (!validMoney(result)) throw new Error("Informe um valor válido, sem números negativos.");
  return result;
}

export async function saveMonthlyTargetAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const owner = await ownerOrThrow();
    const month = String(form.get("month") ?? "");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mês inválido.");
    const cents = money(form.get("target"));
    await mutateCatalogState(state => {
      state.operations.business ??= emptyBusinessSettings();
      state.operations.business.monthlyTargets ??= {};
      state.operations.business.monthlyTargets[month] = cents;
      state.auditLogs.unshift({ id: randomUUID(), actor_id: owner.id, action: "business.target.updated", entity_type: "business", entity_id: month, before_data: null, after_data: { month, targetCents: cents }, created_at: new Date().toISOString() });
      state.auditLogs = state.auditLogs.slice(0, 1000);
    }, { privateOnly: true });
    revalidatePath("/painel");
    return { ok: true, message: "Meta salva." };
  } catch (error) { return { message: error instanceof Error ? error.message : "Não foi possível salvar a meta." }; }
}

export async function saveCampaignBudgetAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const owner = await ownerOrThrow();
    const campaign = String(form.get("campaign") ?? "").trim();
    const from = String(form.get("from") ?? ""), to = String(form.get("to") ?? "");
    const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (!campaign || campaign.length > 160 || !date(from) || !date(to) || from > to) throw new Error("Revise a campanha e as datas do investimento.");
    const cents = money(form.get("investment"));
    const key = `${campaign}::${from}::${to}`;
    await mutateCatalogState(state => {
      state.operations.business ??= emptyBusinessSettings();
      const budgets = state.operations.business.campaignBudgets ??= {};
      if (Object.entries(budgets).some(([id, row]) => id !== key && row.campaign === campaign && row.from <= to && row.to >= from)) throw new Error("Já existe investimento desta campanha nesse intervalo. Edite o período existente para evitar duplicidade.");
      budgets[key] = { campaign, from, to, cents };
      state.auditLogs.unshift({ id: randomUUID(), actor_id: owner.id, action: "business.campaign.updated", entity_type: "campaign", entity_id: campaign, before_data: null, after_data: { campaign, from, to, cents }, created_at: new Date().toISOString() });
      state.auditLogs = state.auditLogs.slice(0, 1000);
    }, { privateOnly: true });
    revalidatePath("/painel/trafego");
    return { ok: true, message: "Investimento salvo. Repetir campanha e datas substitui o valor anterior." };
  } catch (error) { return { message: error instanceof Error ? error.message : "Não foi possível salvar o investimento." }; }
}

export async function saveOrderCostsAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const owner = await ownerOrThrow();
    const id = String(form.get("orderId") ?? "");
    await mutateCatalogState(state => {
      const order = state.operations.orders.find(row => row.id === id);
      if (!order) throw new Error("Pedido não encontrado.");
      const items: Record<string, number> = {};
      order.items.forEach((_, index) => { const value = form.get(`cost-${index}`); if (String(value ?? "").trim()) items[String(index)] = money(value); });
      state.operations.business ??= emptyBusinessSettings();
      state.operations.business.orderCosts ??= {};
      state.operations.business.orderCosts[id] = { items, feesCents: money(form.get("fees")), shippingCents: money(form.get("shipping")) };
      state.auditLogs.unshift({ id: randomUUID(), actor_id: owner.id, action: "business.costs.updated", entity_type: "order", entity_id: id, before_data: null, after_data: { order: order.number, costedItems: Object.keys(items).length }, created_at: new Date().toISOString() });
      state.auditLogs = state.auditLogs.slice(0, 1000);
    }, { privateOnly: true });
    revalidatePath("/painel/financeiro");
    return { ok: true, message: "Custos registrados neste pedido." };
  } catch (error) { return { message: error instanceof Error ? error.message : "Não foi possível salvar os custos." }; }
}
