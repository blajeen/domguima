"use client";

import { useState } from "react";
import { simulateAllInstallments } from "@/lib/admin/card-fees";
import { formatPrice } from "@/lib/utils/format";

/**
 * Simulacao de parcelamento com as taxas da maquininha.
 *
 * Mostra as duas leituras da mesma tabela, porque confundi-las erra o preco:
 *
 *   - REPASSAR: quanto o cliente paga para a loja receber o valor cheio.
 *   - ABSORVER: quanto sobra para a loja cobrando o valor cheio.
 *
 * Escolher uma das duas e esconder a outra obrigaria o vendedor a adivinhar
 * qual numero esta vendo na hora de fechar a venda.
 */
export function InstallmentSimulator({
  cents,
  titulo = "Simulação de parcelamento",
  aberto = false,
}: {
  cents: number;
  titulo?: string;
  aberto?: boolean;
}) {
  const [mostrando, setMostrando] = useState(aberto);

  if (cents <= 0) return null;
  const linhas = simulateAllInstallments(cents);

  return (
    <section className="rounded-xl border border-ink-200 bg-white">
      <button
        type="button"
        onClick={() => setMostrando((atual) => !atual)}
        aria-expanded={mostrando}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-black text-ink-900">{titulo}</span>
          <span className="block text-xs text-ink-500">
            Sobre {formatPrice(cents)} · taxas da maquininha de 2,93% (1x) a 11,51% (12x)
          </span>
        </span>
        <span className="shrink-0 text-xs font-bold text-blue-700">{mostrando ? "ocultar" : "ver tabela"}</span>
      </button>

      {mostrando && (
        <div className="border-t border-ink-100 px-4 pb-4 pt-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-ink-400">
                  <th className="pb-2 pr-3 font-bold">Parcelas</th>
                  <th className="pb-2 pr-3 font-bold">Taxa</th>
                  <th className="pb-2 pr-3 font-bold text-blue-800">Repassando ao cliente</th>
                  <th className="pb-2 pr-3 font-bold text-blue-800">Cliente paga</th>
                  <th className="pb-2 font-bold text-green-800">Absorvendo: loja recebe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {linhas.map((linha) => (
                  <tr key={linha.count}>
                    <td className="py-2 pr-3 font-black text-ink-900">{linha.count}x</td>
                    <td className="py-2 pr-3 text-ink-500">
                      {linha.feePercent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%
                    </td>
                    <td className="py-2 pr-3 font-bold text-ink-900">
                      {linha.count}× {formatPrice(linha.installmentCents)}
                    </td>
                    <td className="py-2 pr-3 text-ink-700">
                      {formatPrice(linha.customerTotalCents)}
                      <span className="ml-1 text-[10px] text-ink-400">+{formatPrice(linha.surchargeCents)}</span>
                    </td>
                    <td className="py-2 font-bold text-green-800">
                      {formatPrice(linha.netCents)}
                      <span className="ml-1 text-[10px] font-normal text-ink-400">−{formatPrice(linha.feeCents)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-600">
            <strong>Repassando</strong>, o cliente cobre a taxa e a loja recebe {formatPrice(cents)} limpos.
            <strong className="ml-2">Absorvendo</strong>, o cliente paga {formatPrice(cents)} e a taxa sai do
            caixa da loja. O valor gravado no pedido continua sendo o que o cliente pagar — a simulação é só
            para fechar a venda.
          </p>
        </div>
      )}
    </section>
  );
}
