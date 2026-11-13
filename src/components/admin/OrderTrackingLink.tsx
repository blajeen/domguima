"use client";
import { useActionState } from "react";
import { createTrackingLinkAction } from "@/app/painel/tracking-actions";
import { FormMessage, SubmitButton, fieldClass } from "./FormControls";

export function OrderTrackingLink({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(createTrackingLinkAction, {});
  return <form action={action} className="mt-4 space-y-2 border-t border-ink-100 pt-3"><input type="hidden" name="orderId" value={orderId} /><SubmitButton>Gerar link de acompanhamento</SubmitButton><FormMessage state={state} />{state.url && <><label className="block text-xs font-bold">Link do comprador<input readOnly value={state.url} onFocus={event => event.currentTarget.select()} className={fieldClass} /></label><a href={state.url} target="_blank" rel="noopener noreferrer" className="block text-xs font-bold text-blue-700 underline">Conferir acompanhamento ↗</a></>}</form>;
}
