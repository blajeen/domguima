"use client";

import { useState } from "react";

/**
 * Barra de acoes em massa da lista de pedidos.
 *
 * Existe porque um lancamento em lote que sai errado deixa dezenas de pedidos
 * para desfazer, e o dono estava cancelando um por um.
 *
 * A selecao usa checkbox HTML comum dentro do mesmo <form> da lista — nao ha
 * estado compartilhado a manter. Este componente so cuida do "marcar todos" e
 * da confirmacao antes de excluir, que precisam de navegador.
 */
export function OrderBulkActions({ total }: { total: number }) {
  const [marcados, setMarcados] = useState(0);

  /** Le a contagem do proprio formulario: a fonte da verdade sao os checkboxes. */
  function recontar(form: HTMLFormElement | null) {
    if (!form) return;
    setMarcados(form.querySelectorAll<HTMLInputElement>('input[name="orderIds"]:checked').length);
  }

  function marcarTodos(event: React.ChangeEvent<HTMLInputElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    for (const caixa of form.querySelectorAll<HTMLInputElement>('input[name="orderIds"]')) {
      caixa.checked = event.currentTarget.checked;
    }
    recontar(form);
  }

  return (
    <div
      onChange={(event) => recontar(event.currentTarget.querySelector("form") ?? (event.target as HTMLElement).closest("form"))}
      className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3"
    >
      <label className="flex items-center gap-2 text-sm font-bold text-ink-800">
        <input type="checkbox" onChange={marcarTodos} className="h-4 w-4" />
        Marcar os {total} da tela
      </label>

      <span className="text-sm text-ink-500">
        {marcados > 0 ? `${marcados} selecionado(s)` : "nenhum selecionado"}
      </span>

      <div className="ml-auto flex flex-wrap gap-2">
        <button
          name="acao"
          value="cancelar"
          disabled={marcados === 0}
          onClick={(event) => {
            if (!window.confirm(`Cancelar ${marcados} pedido(s)?\n\nO estoque volta e os pedidos ficam no histórico marcados como cancelados.`)) {
              event.preventDefault();
            }
          }}
          className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-extrabold text-ink-800 disabled:opacity-40"
        >
          Cancelar selecionados
        </button>
        <button
          name="acao"
          value="excluir"
          disabled={marcados === 0}
          onClick={(event) => {
            if (!window.confirm(`Excluir ${marcados} pedido(s) em definitivo?\n\nEles somem dos relatórios. O estoque é devolvido antes, e os movimentos continuam no histórico.\n\nNão há como desfazer.`)) {
              event.preventDefault();
            }
          }}
          className="rounded-lg bg-red-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-40"
        >
          Excluir selecionados
        </button>
      </div>
    </div>
  );
}
