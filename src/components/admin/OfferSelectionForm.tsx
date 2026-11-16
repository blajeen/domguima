"use client";

import { useActionState, useId, type ReactNode } from "react";
import { saveOfferSelectionAction } from "@/app/painel/offer-actions";
import { FormMessage, SubmitButton } from "./FormControls";

export interface OfferSelectionRow { id: string; checked: boolean; content: ReactNode; extra?: ReactNode }

/**
 * Lista com caixinha por produto, "Selecionar todos" / "Desmarcar todos" e um único Salvar.
 * As caixinhas usam o atributo `form`: assim cada linha pode ter seu próprio formulário (período) sem aninhar forms.
 */
export function OfferSelectionForm({ field, rows, label }: { field: "offer" | "flash"; rows: OfferSelectionRow[]; label: string }) {
  const [state, action] = useActionState(saveOfferSelectionAction, {});
  const formId = useId();
  const marcar = (on: boolean) => document.querySelectorAll<HTMLInputElement>(`input[name="ids"][form="${CSS.escape(formId)}"]`).forEach(box => { box.checked = on; });
  const botao = "rounded-lg border border-ink-200 px-3 py-2 text-xs font-bold hover:border-gold-400";
  return <>
    <form id={formId} action={action} className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-ink-100 bg-white py-3">
      <input type="hidden" name="field" value={field} />
      <button type="button" onClick={() => marcar(true)} className={botao}>Selecionar todos</button>
      <button type="button" onClick={() => marcar(false)} className={botao}>Desmarcar todos</button>
      <SubmitButton className="ml-auto">Salvar seleção</SubmitButton>
      <div className="w-full empty:hidden"><FormMessage state={state} /></div>
    </form>
    <div className="divide-y divide-ink-100">{rows.map(row => <div key={row.id} className="py-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="hidden" name="shown" value={row.id} form={formId} />
        <input type="checkbox" name="ids" value={row.id} form={formId} defaultChecked={row.checked} aria-label={label} className="mt-1 size-5 shrink-0 accent-gold-500" />
        <div className="min-w-0 flex-1">{row.content}</div>
      </label>
      {row.extra}
    </div>)}</div>
  </>;
}
