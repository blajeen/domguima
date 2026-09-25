"use client";

import { useActionState, useState } from "react";
import { salvarVendaLojistasAction } from "@/app/painel/actions";
import { CONDICOES_LOJISTA_MAXIMO, DESCONTO_LOJISTA_MAXIMO, lerDescontoDigitado, precoComDesconto, type VendaLojistas } from "@/lib/admin/lojistas";
import { formatPrice } from "@/lib/utils/format";
import { FormMessage, SubmitButton, fieldClass, labelClass } from "../FormControls";

/**
 * Desconto geral, condições e o preço do site no catálogo para lojistas.
 *
 * Campos controlados e a mesma validação da action antes do envio: o React
 * reinicia o formulário a cada envio, e um erro vindo do servidor apagaria o
 * que foi digitado. Com erro, o campo fica marcado e o navegador não envia.
 * A ajuda fica fora do <label> e entra por aria-describedby: dentro do
 * rótulo, ela virava parte do nome lido pelo leitor de tela.
 */
export function VendaLojistasForm({ inicial }: { inicial: VendaLojistas }) {
  const [state, action] = useActionState(salvarVendaLojistasAction, {});
  const descontoInicial = String(inicial.descontoPercent).replace(".", ",");
  const [desconto, setDesconto] = useState(descontoInicial);
  const [condicoes, setCondicoes] = useState(inicial.condicoes);
  // Quando o valor salvo muda (depois de Salvar), o campo passa a mostrar o
  // formato salvo: "12.5" digitado vira "12,5".
  const [base, setBase] = useState(descontoInicial);
  if (base !== descontoInicial) { setBase(descontoInicial); setDesconto(descontoInicial); }
  const [mostrarPrecoSite, setMostrarPrecoSite] = useState(inicial.mostrarPrecoSite);
  const valor = lerDescontoDigitado(desconto);
  const erroDesconto = valor === null ? `Use um número de 0 a ${DESCONTO_LOJISTA_MAXIMO}, como 10 ou 12,5.` : "";
  const erroCondicoes = condicoes.length > CONDICOES_LOJISTA_MAXIMO ? `No máximo ${CONDICOES_LOJISTA_MAXIMO} caracteres (agora ${condicoes.length}).` : "";
  // Compara o valor, não o texto: "12.5" com 12,5 salvo não é mudança. A
  // action grava as condições sem espaço nas pontas.
  const mudou = valor !== inicial.descontoPercent || condicoes.trim() !== inicial.condicoes || mostrarPrecoSite !== inicial.mostrarPrecoSite;

  return <form action={action} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
      <div>
        <label htmlFor="lojistas-desconto" className={labelClass}>Desconto para lojistas</label>
        <span className="relative block">
          <input
            id="lojistas-desconto" name="descontoPercent" value={desconto} onChange={(event) => setDesconto(event.target.value)}
            inputMode="decimal" autoComplete="off" required
            aria-invalid={Boolean(erroDesconto) || undefined} aria-describedby="lojistas-desconto-ajuda"
            ref={(campo) => campo?.setCustomValidity(erroDesconto)}
            className={`${fieldClass} pr-8 ${erroDesconto ? "border-red-500 ring-2 ring-red-100" : ""}`}
          />
          <span aria-hidden className="pointer-events-none absolute bottom-0 right-3 top-1.5 flex items-center text-ink-400">%</span>
        </span>
        <p id="lojistas-desconto-ajuda" className={`mt-1 text-xs ${erroDesconto ? "font-bold text-red-700" : "text-ink-500"}`}>
          {erroDesconto || (valor !== null ? `Sobre o preço à vista do site. Ex.: R$ 100,00 sai por ${formatPrice(precoComDesconto(10_000, valor))}.` : "")}
        </p>
      </div>
      <div>
        <label htmlFor="lojistas-condicoes" className={labelClass}>Condições no rodapé do catálogo (opcional)</label>
        <textarea
          id="lojistas-condicoes" name="condicoes" value={condicoes} onChange={(event) => setCondicoes(event.target.value)} rows={2}
          placeholder="Ex.: pedido mínimo, forma de pagamento, retirada na loja"
          aria-invalid={Boolean(erroCondicoes) || undefined} aria-describedby="lojistas-condicoes-ajuda"
          ref={(campo) => campo?.setCustomValidity(erroCondicoes)}
          className={`${fieldClass} ${erroCondicoes ? "border-red-500 ring-2 ring-red-100" : ""}`}
        />
        <p id="lojistas-condicoes-ajuda" className={`mt-1 text-xs ${erroCondicoes ? "font-bold text-red-700" : "text-ink-500"}`}>
          {erroCondicoes || "Vazio: o catálogo sai só com a data e o contato."}
        </p>
      </div>
    </div>
    <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-700">
      {/* O React reinicia o form depois de cada envio (form.reset()), e a
          caixa volta ao defaultChecked, que o React só grava na montagem.
          Acompanhar o defaultChecked pelo ref mantém a caixa como foi salva. */}
      <input
        type="checkbox" name="mostrarPrecoSite" checked={mostrarPrecoSite} onChange={(event) => setMostrarPrecoSite(event.target.checked)}
        ref={(caixa) => { if (caixa) caixa.defaultChecked = mostrarPrecoSite; }}
        className="h-4 w-4 accent-gold-500"
      />
      Mostrar no catálogo o preço à vista do site, ao lado do preço para lojista
    </label>
    <div className="flex flex-wrap items-center gap-3">
      <SubmitButton pendingLabel="Salvando..." disabled={!mudou}>Salvar</SubmitButton>
      <FormMessage state={state} />
    </div>
  </form>;
}
