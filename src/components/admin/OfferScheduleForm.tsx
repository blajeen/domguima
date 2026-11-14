"use client";

import { useActionState } from "react";
import { saveOfferScheduleAction } from "@/app/painel/offer-actions";
import type { OfferSchedule } from "@/lib/catalog/offer-schedule";
import { FormMessage, SubmitButton } from "./FormControls";

export function OfferScheduleForm({ id, schedule }: { id: string; schedule: OfferSchedule }) {
  const [state, action] = useActionState(saveOfferScheduleAction, {});
  return <details className="mt-3 rounded-lg border border-ink-100 p-3 text-xs"><summary className="cursor-pointer font-bold">Programar exibição da oferta</summary><form action={action} className="mt-3 flex flex-wrap items-end gap-3"><input type="hidden" name="id" value={id} /><label className="font-bold">Início<input type="date" name="starts" defaultValue={schedule.starts} className="mt-1 block rounded border border-ink-200 p-2" /></label><label className="font-bold">Término<input type="date" name="ends" defaultValue={schedule.ends} className="mt-1 block rounded border border-ink-200 p-2" /></label><SubmitButton>Salvar período</SubmitButton><p className="w-full text-ink-500">Datas inclusivas no horário de Brasília. Em branco, sem restrição. Fora do período, saem o selo e o destaque em Ofertas; o preço cadastrado continua igual.</p><FormMessage state={state} /></form></details>;
}
