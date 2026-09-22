"use client";

import { useActionState, useEffect, useRef } from "react";
import { createLeadAction } from "@/app/painel/actions";
import type { SellerRecord } from "@/lib/admin/types";
import { FormMessage, SubmitButton, fieldClass, labelClass } from "./FormControls";

interface LeadFormProps {
  sellers: SellerRecord[];
  /** Atendente vinculado ao login; quando existe, "Eu" vira o padrão. */
  ownerSellerId: string | null;
}

/**
 * Atendimento lançado a mão: cliente que apareceu na loja, veio por indicação
 * ou chamou num número que não passou pelo site.
 *
 * O formulário se limpa no sucesso porque a tela é de cadastro em sequência —
 * deixar os campos preenchidos convida a registrar o mesmo cliente duas vezes.
 */
export function LeadForm({ sellers, ownerSellerId }: LeadFormProps) {
  const [state, action] = useActionState(createLeadAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const ativos = sellers.filter((seller) => seller.active);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
      <label className={labelClass}>
        Cliente
        <input name="customerName" required maxLength={140} placeholder="Nome de quem está sendo atendido" className={fieldClass} />
      </label>
      <label className={labelClass}>
        WhatsApp <span className="font-normal text-ink-400">(opcional)</span>
        <input name="customerPhone" inputMode="tel" maxLength={30} placeholder="(34) 99999-9999" className={fieldClass} />
      </label>
      <label className={labelClass}>
        Atendente
        <select name="sellerId" defaultValue={ownerSellerId ? "me" : ""} className={fieldClass}>
          {ownerSellerId && <option value="me">Eu</option>}
          <option value="">Fila livre</option>
          {ativos.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
        </select>
      </label>
      <label className={labelClass}>
        Observação <span className="font-normal text-ink-400">(opcional)</span>
        <input name="notes" maxLength={500} placeholder="O que o cliente procura" className={fieldClass} />
      </label>
      <div className="sm:col-span-2 xl:col-span-3"><FormMessage state={state} /></div>
      <SubmitButton pendingLabel="Registrando...">Registrar atendimento</SubmitButton>
    </form>
  );
}
