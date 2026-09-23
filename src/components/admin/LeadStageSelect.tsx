"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { changeLeadStageAction } from "@/app/painel/actions";
import {
  LEAD_LOST_REASON_LABELS,
  LEAD_LOST_REASONS,
  LEAD_STAGE_LABELS,
  LEAD_STAGES,
  type LeadLostReason,
  type LeadStage,
} from "@/lib/admin/types";

interface LeadStageSelectProps {
  leadId: string;
  stage: LeadStage;
  lostReason: LeadLostReason | null;
  /** URL para onde voltar depois da ação, preservando aba e filtros. */
  volta: string;
  /**
   * Preenchido quando a etapa não pode mudar (pedido do atendimento já
   * confirmado e atendimento em Ganho): o select fica travado e o texto
   * explica por quê.
   */
  lockedReason?: string;
  /**
   * Únicas etapas que o atendimento pode receber, além da atual. Serve ao caso
   * do pedido confirmado cujo atendimento não chegou a Ganho (o fechamento
   * automático falhou): só "Ganho" é aceito, e já vem escolhido para o
   * operador acertar com um clique.
   */
  allowedStages?: readonly LeadStage[];
  /** Explicação curta ao lado do botão quando as etapas estão restritas. */
  note?: string;
}

const CAMPO = "rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs disabled:bg-ink-50 disabled:text-ink-400";

/**
 * Etapa do atendimento no funil, com o motivo obrigatório quando é "Perdido".
 *
 * O select de motivo só aparece ao escolher "Perdido" e é `required`: o
 * próprio navegador barra o envio sem motivo, e a action confere de novo. O
 * botão fica desativado enquanto nada mudou, para um clique distraído não
 * gravar uma troca de etapa que não aconteceu.
 */
export function LeadStageSelect({ leadId, stage, lostReason, volta, lockedReason, allowedStages, note }: LeadStageSelectProps) {
  const opcoes = allowedStages ? LEAD_STAGES.filter((valor) => valor === stage || allowedStages.includes(valor)) : LEAD_STAGES;
  const sugerida = allowedStages?.find((valor) => valor !== stage);
  const [etapa, setEtapa] = useState<LeadStage>(sugerida ?? stage);
  const [motivo, setMotivo] = useState<LeadLostReason | "">(lostReason ?? "");
  const mudou = etapa !== stage || (etapa === "lost" && motivo !== (lostReason ?? ""));

  return (
    <form action={changeLeadStageAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="volta" value={volta} />
      <label className="flex items-center gap-2 text-xs font-bold text-ink-600">
        Etapa
        <select
          name="stage"
          value={etapa}
          onChange={(event) => setEtapa(event.target.value as LeadStage)}
          disabled={Boolean(lockedReason)}
          title={lockedReason}
          className={CAMPO}
        >
          {opcoes.map((valor) => <option key={valor} value={valor}>{LEAD_STAGE_LABELS[valor]}</option>)}
        </select>
      </label>
      {etapa === "lost" && !lockedReason && (
        <label className="flex items-center gap-2 text-xs font-bold text-ink-600">
          Motivo
          <select name="lostReason" required value={motivo} onChange={(event) => setMotivo(event.target.value as LeadLostReason | "")} className={CAMPO}>
            <option value="">Escolha o motivo…</option>
            {LEAD_LOST_REASONS.map((valor) => <option key={valor} value={valor}>{LEAD_LOST_REASON_LABELS[valor]}</option>)}
          </select>
        </label>
      )}
      {lockedReason
        ? <span className="text-[11px] text-ink-400">{lockedReason}</span>
        : <SalvarEtapa disabled={!mudou} />}
      {!lockedReason && note && <span className="text-[11px] font-bold text-orange-700">{note}</span>}
    </form>
  );
}

function SalvarEtapa({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-lg bg-ink-900 px-3 py-2 text-xs font-extrabold text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Salvando..." : "Salvar etapa"}
    </button>
  );
}
