"use client";

import { useActionState } from "react";
import { saveMonthlyTargetAction, saveCampaignBudgetAction, saveOrderCostsAction } from "@/app/painel/business-actions";
import { FormMessage, SubmitButton, fieldClass, labelClass } from "./FormControls";

const value = (cents?: number | null) => cents === null || cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ",");

export function MonthlyTargetForm({ month, cents }: { month: string; cents: number }) {
  const [state, action] = useActionState(saveMonthlyTargetAction, {});
  return <form action={action} className="mt-3 space-y-2"><input type="hidden" name="month" value={month} /><label className={labelClass}>Meta de faturamento do mês (R$)<input name="target" inputMode="decimal" defaultValue={value(cents)} required className={fieldClass} /></label><SubmitButton>Salvar meta</SubmitButton><FormMessage state={state} /><p className="text-xs text-ink-500">Informe zero para retirar a meta.</p></form>;
}

export function CampaignBudgetForm({ from, to, campaigns, initial }: { from: string; to: string; campaigns: string[]; initial?: { campaign: string; from: string; to: string; cents: number } }) {
  const [state, action] = useActionState(saveCampaignBudgetAction, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className={labelClass}>Campanha<input name="campaign" list="budget-campaigns" defaultValue={initial?.campaign} required maxLength={160} className={fieldClass} /><datalist id="budget-campaigns">{campaigns.map(name => <option key={name} value={name} />)}</datalist></label><label className={labelClass}>Início<input type="date" name="from" defaultValue={initial?.from ?? from} required className={fieldClass} /></label><label className={labelClass}>Fim<input type="date" name="to" defaultValue={initial?.to ?? to} required className={fieldClass} /></label><label className={labelClass}>Investimento total (R$)<input name="investment" inputMode="decimal" defaultValue={value(initial?.cents)} required className={fieldClass} /></label><div className="sm:col-span-2 lg:col-span-4"><SubmitButton>Salvar investimento</SubmitButton><FormMessage state={state} /></div></form>;
}

export function OrderCostForm({ id, items, feesCents, shippingCents }: { id: string; items: { name: string; cost: number | null | undefined }[]; feesCents?: number; shippingCents?: number }) {
  const [state, action] = useActionState(saveOrderCostsAction, {});
  return <form action={action} className="mt-3 space-y-3"><input type="hidden" name="orderId" value={id} /><div className="grid gap-3 sm:grid-cols-2">{items.map((item, index) => <label key={index} className={labelClass}>Custo unitário: {item.name} (R$)<input name={`cost-${index}`} inputMode="decimal" defaultValue={value(item.cost)} placeholder="Desconhecido" className={fieldClass} /></label>)}<label className={labelClass}>Taxas totais do pedido (R$)<input name="fees" inputMode="decimal" defaultValue={value(feesCents ?? 0)} className={fieldClass} /></label><label className={labelClass}>Frete pago pela loja (R$)<input name="shipping" inputMode="decimal" defaultValue={value(shippingCents ?? 0)} className={fieldClass} /></label></div><p className="text-xs text-ink-500">Campo vazio mantém o custo original; sem custo original, permanece desconhecido. Zero representa custo zero informado. Taxas e frete são valores totais, além da comissão já registrada.</p><SubmitButton>Salvar custos deste pedido</SubmitButton><FormMessage state={state} /></form>;
}
