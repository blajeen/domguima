"use client";

import { useEffect, useState } from "react";

/** Checkboxes de seleção ligados ao formulário (dentro dele ou pelo atributo `form=`). */
function caixasDoFormulario(form: HTMLFormElement): HTMLInputElement[] {
  return Array.from(form.elements).filter(
    (elemento): elemento is HTMLInputElement => elemento instanceof HTMLInputElement && elemento.name === "orderIds",
  );
}

function contarMarcados(form: HTMLFormElement | null): number {
  return form ? caixasDoFormulario(form).filter((caixa) => caixa.checked).length : 0;
}

/**
 * Barra de acoes em massa da lista de pedidos.
 *
 * Existe porque um lancamento em lote que sai errado deixa dezenas de pedidos
 * para desfazer, e o dono estava cancelando um por um.
 *
 * A selecao usa checkbox HTML comum ligado ao formulario — nao ha estado
 * compartilhado a manter. Este componente so cuida do "marcar todos", da
 * contagem e da confirmacao antes de excluir, que precisam de navegador.
 *
 * `formId` e o `id` do <form> de massa. Os checkboxes dos cards ligam-se a ele
 * pelo atributo `form=` em vez de ficarem DENTRO dele: cada card tem os
 * proprios formularios (atribuir, confirmar, cancelar), e com a lista inteira
 * dentro do form de massa eles ficavam aninhados — HTML invalido, que o
 * navegador corrige descartando o <form> interno e quebrando a hidratacao.
 */
export function OrderBulkActions({ total, formId }: { total: number; formId: string }) {
  const [marcados, setMarcados] = useState(0);

  // Os checkboxes moram nos cards, fora desta árvore: o `onChange` do React
  // não chegaria aqui. Um ouvinte no documento recebe a mudança de qualquer
  // caixa ligada ao formulário e recontar pelo próprio formulário mantém os
  // checkboxes como a única fonte da verdade.
  useEffect(() => {
    function aoMudar(event: Event) {
      const alvo = event.target;
      if (alvo instanceof HTMLInputElement && alvo.name === "orderIds" && alvo.form?.id === formId) {
        setMarcados(contarMarcados(alvo.form));
      }
    }
    // Depois da ação em massa o React 19 reseta o <form action={fn}>, e o reset
    // desmarca as caixas SEM disparar `change`. Como a volta muda só a query,
    // este componente não é remontado: sem ouvir o reset, a barra continuaria
    // dizendo "3 selecionado(s)" com tudo desmarcado. As caixas só voltam ao
    // padrão depois do evento, daí a recontagem num microtask.
    const form = document.getElementById(formId);
    function aoResetar() {
      queueMicrotask(() => setMarcados(contarMarcados(form instanceof HTMLFormElement ? form : null)));
    }
    document.addEventListener("change", aoMudar);
    form?.addEventListener("reset", aoResetar);
    return () => {
      document.removeEventListener("change", aoMudar);
      form?.removeEventListener("reset", aoResetar);
    };
  }, [formId]);

  function marcarTodos(event: React.ChangeEvent<HTMLInputElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    for (const caixa of caixasDoFormulario(form)) {
      caixa.checked = event.currentTarget.checked;
    }
    setMarcados(contarMarcados(form));
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3">
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
            if (!window.confirm(`Excluir ${marcados} pedido(s) em definitivo?\n\nEles somem dos relatórios, junto com o atendimento que o site criou para cada pedido. O estoque é devolvido antes, e os movimentos continuam no histórico.\n\nNão há como desfazer.`)) {
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
