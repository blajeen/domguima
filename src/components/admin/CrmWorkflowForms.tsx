"use client";

import { useActionState } from "react";
import { identifyOrderCustomerAction, saveCrmWorkflowAction } from "@/app/painel/crm-actions";
import { DELIVERY_STATUS_LABELS, PAYMENT_STATUS_LABELS, type CrmWorkflowEntry } from "@/lib/admin/crm-workflow-types";
import { FormMessage, SubmitButton, fieldClass, labelClass } from "./FormControls";

export function OrderWorkflowForm({ id, value }: { id: string; value?: CrmWorkflowEntry }) {
  const [state, action] = useActionState(saveCrmWorkflowAction, {});
  return <form action={action} className="mt-4 space-y-3 border-t border-ink-100 pt-3"><input type="hidden" name="kind" value="order" /><input type="hidden" name="entityId" value={id} /><p className="font-bold">Acompanhamento operacional</p><label className={labelClass}>Pagamento<select name="payment" defaultValue={value?.payment_status ?? "unconfirmed"} className={fieldClass}>{Object.entries(PAYMENT_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className={labelClass}>Entrega / retirada<select name="delivery" defaultValue={value?.delivery_status ?? "unconfirmed"} className={fieldClass}>{Object.entries(DELIVERY_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><p className="text-xs text-ink-500">Anotação manual, independente da confirmação do pedido. Não movimenta estoque nem efetua cobranças.</p><FormMessage state={state} /><SubmitButton>Salvar acompanhamento</SubmitButton></form>;
}
export function FollowupForm({ id, value }: { id: string; value?: CrmWorkflowEntry }) {
  const [state, action] = useActionState(saveCrmWorkflowAction, {});
  const local = value?.next_contact_at ? new Date(Date.parse(value.next_contact_at) - 3 * 3600_000).toISOString().slice(0, 16) : "";
  return <form action={action} className="mt-3 flex flex-wrap items-end gap-2"><input type="hidden" name="kind" value="lead" /><input type="hidden" name="entityId" value={id} /><label className={labelClass}>Próximo retorno (horário de Brasília)<input type="datetime-local" name="nextContact" defaultValue={local} className={fieldClass} /></label><SubmitButton>Agendar retorno</SubmitButton><p className="w-full text-xs text-ink-500">Apague a data e salve para retirar o lembrete.</p><FormMessage state={state} /></form>;
}
export function ContactLogForm({ reference }: { reference: string }) {
  const [state, action] = useActionState(saveCrmWorkflowAction, {});
  return <form action={action} className="text-xs"><input type="hidden" name="kind" value="customer" /><input type="hidden" name="entityId" value={reference} /><SubmitButton>Registrar recontato feito</SubmitButton><FormMessage state={state} /></form>;
}
export function IdentifyOrderCustomerForm({ id, name }: { id: string; name: string }) {
  const [state, action] = useActionState(identifyOrderCustomerAction, {});
  return <form action={action} className="mt-3 grid gap-3 sm:grid-cols-3"><input type="hidden" name="orderId" value={id} /><label className={labelClass}>Nome do comprador<input name="name" defaultValue={name} required minLength={3} maxLength={140} className={fieldClass} /></label><label className={labelClass}>Telefone com DDD<input name="phone" type="tel" maxLength={30} className={fieldClass} /></label><label className={labelClass}>CPF/CNPJ (opcional com telefone)<input name="document" inputMode="numeric" maxLength={30} className={fieldClass} /></label><p className="text-xs text-ink-500 sm:col-span-3">Confirme quem fez esta compra. Cada pedido é identificado individualmente, sem juntar pessoas somente pelo nome.</p><FormMessage state={state} /><SubmitButton>Identificar comprador</SubmitButton></form>;
}
