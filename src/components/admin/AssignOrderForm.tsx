"use client";

import { useFormStatus } from "react-dom";
import { assignOrderAction } from "@/app/painel/actions";
import { UNASSIGNED_ORDER_SELLER_ID, type SellerRecord } from "@/lib/admin/types";
import { fieldClass, labelClass } from "./FormControls";

interface AssignOrderFormProps {
  orderId: string;
  /** `seller_id` atual do pedido; `UNASSIGNED_ORDER_SELLER_ID` = fila livre. */
  currentSellerId: string;
  sellers: SellerRecord[];
  /** URL da lista atual (busca e filtros), para voltar a ela depois de atribuir. */
  volta: string;
}

/**
 * Quem cuida do pedido do site enquanto ele aguarda confirmação.
 *
 * Separado da confirmação de propósito: atribuir não baixa estoque. O dono
 * define (ou troca) quem vai conversar com o cliente, e só confirma depois de
 * acertar disponibilidade, frete e pagamento.
 */
export function AssignOrderForm({ orderId, currentSellerId, sellers, volta }: AssignOrderFormProps) {
  const atual = currentSellerId === UNASSIGNED_ORDER_SELLER_ID ? "" : currentSellerId;
  const ativos = sellers.filter((seller) => seller.active);
  // Atendente desativado depois de receber o pedido continua aparecendo como
  // valor atual — senão o select mostraria "Fila livre" para um pedido que tem
  // dono, e um clique distraído o devolveria à fila. A opção não é `disabled`
  // porque opção desabilitada não vai no envio (viraria "fila livre" do mesmo
  // jeito); reenviá-la só produz o aviso "Escolha um atendente ativo".
  const atualInativo = atual && !ativos.some((seller) => seller.id === atual) ? sellers.find((seller) => seller.id === atual) : undefined;

  return (
    <form action={assignOrderAction} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="volta" value={volta} />
      <label className={labelClass}>
        Atendente do pedido
        <select name="sellerId" defaultValue={atual} className={fieldClass}>
          <option value="">Fila livre (sem atendente)</option>
          {atualInativo && <option value={atualInativo.id}>{atualInativo.name} (inativo)</option>}
          {ativos.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
        </select>
      </label>
      <AtribuirButton />
    </form>
  );
}

function AtribuirButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-xs font-extrabold text-ink-800 transition-colors hover:border-gold-400 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Atribuindo..." : "Atribuir sem confirmar"}
    </button>
  );
}
