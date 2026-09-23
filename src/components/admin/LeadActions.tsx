"use client";

import { assignLeadAction } from "@/app/painel/actions";
import { UNLINKED_LOGIN_HINT } from "@/lib/admin/sellers";
import type { SellerRecord } from "@/lib/admin/types";

interface LeadActionsProps {
  leadId: string;
  /** Atendente atual; `null` = o atendimento está na fila livre. */
  currentSellerId: string | null;
  sellers: SellerRecord[];
  /** Atendente vinculado ao login. `null` desabilita "Puxar para mim". */
  ownerSellerId: string | null;
  /** URL para onde voltar depois da ação, preservando aba e filtros. */
  volta: string;
}

const BOTAO = "rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-extrabold text-ink-800 transition-colors hover:border-gold-400 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Puxar para mim, transferir e devolver à fila.
 *
 * Três formulários irmãos (nunca aninhados) apontando para a mesma action: o
 * que muda é o `sellerId` enviado — "me", o id escolhido ou vazio (fila livre).
 */
export function LeadActions({ leadId, currentSellerId, sellers, ownerSellerId, volta }: LeadActionsProps) {
  const ativos = sellers.filter((seller) => seller.active);
  const euMesmo = Boolean(ownerSellerId) && currentSellerId === ownerSellerId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={assignLeadAction}>
        <Campos leadId={leadId} volta={volta} />
        <input type="hidden" name="sellerId" value="me" />
        <button
          type="submit"
          disabled={!ownerSellerId || euMesmo}
          title={!ownerSellerId
            ? UNLINKED_LOGIN_HINT
            : euMesmo
              ? "Este atendimento já é seu."
              : undefined}
          className={BOTAO}
        >
          Puxar para mim
        </button>
      </form>

      <form action={assignLeadAction} className="flex items-center gap-2">
        <Campos leadId={leadId} volta={volta} />
        {/* `required` + opção vazia: o próprio navegador barra o envio sem
            escolha, o que evita transferir para "ninguém" sem querer. */}
        <select name="sellerId" required defaultValue="" className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs">
          <option value="">Transferir para…</option>
          {ativos.filter((seller) => seller.id !== currentSellerId).map((seller) => (
            <option key={seller.id} value={seller.id}>{seller.name}</option>
          ))}
        </select>
        <button type="submit" className={BOTAO}>Transferir</button>
      </form>

      {currentSellerId && (
        <form
          action={assignLeadAction}
          onSubmit={(event) => {
            if (!window.confirm("Devolver este atendimento à fila livre? Ele fica sem responsável até alguém puxar.")) event.preventDefault();
          }}
        >
          <Campos leadId={leadId} volta={volta} />
          <input type="hidden" name="sellerId" value="" />
          <button type="submit" className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-extrabold text-orange-700 transition-colors hover:border-orange-400">
            Devolver à fila
          </button>
        </form>
      )}
    </div>
  );
}

function Campos({ leadId, volta }: { leadId: string; volta: string }) {
  return (
    <>
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="volta" value={volta} />
    </>
  );
}
