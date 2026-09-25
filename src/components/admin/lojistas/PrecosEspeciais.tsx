"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { salvarPrecoLojistaAction } from "@/app/painel/actions";
import { descontoEquivalente, lerDinheiroDigitado, validarPrecoEspecial, type LinhaLojista } from "@/lib/admin/lojistas";
import type { ActionState } from "@/lib/admin/types";
import { formatPrice, normalize } from "@/lib/utils/format";

/**
 * Preço especial por produto (ou por opção): para baixar mais que o desconto
 * geral num item só. Cada linha é um formulário pequeno; vazio + Salvar, ou
 * "Tirar", volta a linha para o desconto geral.
 *
 * A busca esconde as linhas (atributo hidden) em vez de tirá-las da tela: um
 * preço digitado e ainda não salvo continua lá quando a busca muda.
 */
export function PrecosEspeciais({ linhas, descontoRotulo }: { linhas: LinhaLojista[]; descontoRotulo: string }) {
  const [busca, setBusca] = useState("");
  const [soEspeciais, setSoEspeciais] = useState(false);
  const visiveis = useMemo(() => {
    const termo = normalize(busca);
    return new Set(linhas.filter((linha) => (!soEspeciais || linha.especialCents !== null)
      && (!termo || normalize(`${linha.nome} ${linha.opcao ?? ""} ${linha.sku} ${linha.categoria}`).includes(termo))).map((linha) => linha.chave));
  }, [busca, linhas, soEspeciais]);
  const especiais = linhas.filter((linha) => linha.especialCents !== null).length;

  return <div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="block min-w-60 flex-1 text-xs font-bold text-ink-600">Buscar produto
        <input type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nome, SKU ou categoria" className="mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base text-ink-900 outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-100 sm:text-sm" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-700">
        <input type="checkbox" checked={soEspeciais} onChange={(event) => setSoEspeciais(event.target.checked)} className="h-4 w-4 accent-gold-500" />
        Só com preço especial ({especiais})
      </label>
    </div>
    <p className="mt-2 text-xs text-ink-500" aria-live="polite">{visiveis.size} de {linhas.length} itens publicados.</p>
    <div className="mt-3 overflow-x-auto rounded-xl border border-ink-100">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-ink-50 text-xs text-ink-500">
          <tr>
            {/* A 1ª coluna fica presa ao rolar a tabela para o lado: no
                celular, quem edita o preço continua vendo de qual produto é. */}
            <th scope="col" className="sticky left-0 z-10 bg-ink-50 px-3 py-2 font-bold">Produto</th>
            <th scope="col" className="px-3 py-2 text-right font-bold">Estoque</th>
            <th scope="col" className="px-3 py-2 text-right font-bold">À vista no site</th>
            <th scope="col" className="px-3 py-2 text-right font-bold">Com {descontoRotulo}</th>
            <th scope="col" className="px-3 py-2 font-bold">Preço especial</th>
            <th scope="col" className="px-3 py-2 text-right font-bold">No catálogo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {linhas.map((linha) => <LinhaPreco key={linha.chave} linha={linha} descontoRotulo={descontoRotulo} oculta={!visiveis.has(linha.chave)} />)}
        </tbody>
      </table>
      {visiveis.size === 0 && <p className="px-3 py-6 text-center text-sm text-ink-500">Nenhum item encontrado.</p>}
    </div>
  </div>;
}

type EstadoLinha = ActionState & { enviado?: string };

function textoDoPreco(cents: number | null): string {
  return cents !== null ? (cents / 100).toFixed(2).replace(".", ",") : "";
}

/**
 * Uma linha, com chave estável: depois de Salvar ou Tirar ela não remonta, o
 * foco fica no botão e a confirmação aparece. Quando o valor salvo muda, o
 * campo acompanha (estado derivado ajustado durante o render).
 */
function LinhaPreco({ linha, descontoRotulo, oculta }: { linha: LinhaLojista; descontoRotulo: string; oculta: boolean }) {
  // Guarda o texto enviado junto com a resposta: a falha do servidor (item
  // saiu do site, desconto mudou em outra aba) fica na tela enquanto o campo
  // tiver o mesmo texto, em vez de sumir atrás da dica.
  const [state, action] = useActionState(async (anterior: EstadoLinha, dados: FormData): Promise<EstadoLinha> => {
    const resposta = await salvarPrecoLojistaAction(anterior, dados);
    return { ...resposta, enviado: dados.get("acao") === "tirar" ? "" : String(dados.get("preco") ?? "") };
  }, {});
  const salvo = textoDoPreco(linha.especialCents);
  const [base, setBase] = useState(salvo);
  const [texto, setTexto] = useState(salvo);
  if (base !== salvo) { setBase(salvo); setTexto(salvo); }

  // Mudou é pelo valor, não pelo texto: "139.93" com 139,93 salvo não é
  // mudança. Texto que não vira preço conta como mudado, para o erro aparecer.
  const cents = texto.trim() ? lerDinheiroDigitado(texto) : null;
  const mudou = texto.trim() ? cents === null || cents !== linha.especialCents : linha.especialCents !== null;
  const validacao = validarPrecoEspecial(texto, linha.comDescontoCents);
  const erro = mudou && !validacao.ok ? validacao.mensagem : "";
  const equivalente = mudou && validacao.ok && validacao.cents !== null ? descontoEquivalente(validacao.cents, linha.varejoCents) : null;
  const falhou = !state.ok && state.message && state.enviado === texto ? state.message : "";
  const idAjuda = `preco-${linha.chave.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const rotulo = linha.opcao ? `${linha.nome} · ${linha.opcao}` : linha.nome;
  const ativo = linha.especialCents !== null && !linha.especialSemEfeito;

  // Uma mensagem por vez, na ordem do que importa agora.
  const ajuda: { texto: string; alerta: boolean } | null = erro ? { texto: erro, alerta: true }
    : falhou ? { texto: falhou, alerta: true }
    : equivalente !== null ? { texto: equivalente >= 50 ? `Confira: dá ${equivalente}% abaixo do preço no site.` : `Dá ${equivalente}% abaixo do preço no site.`, alerta: equivalente >= 50 }
    : !mudou && linha.especialSemEfeito ? { texto: `Não está abaixo do preço com ${descontoRotulo}: sem efeito até você baixar ou tirar.`, alerta: true }
    : state.ok && state.message ? { texto: state.message, alerta: false }
    : null;

  return <tr hidden={oculta} className={ativo ? "bg-gold-50" : undefined}>
    <td className={`sticky left-0 z-10 px-3 py-2 ${ativo ? "bg-gold-50" : "bg-white"}`}>
      {/* No celular a coluna presa fica estreita (o div limita a largura; em
          célula de tabela, max-width não vale): sobra tela para o preço. */}
      <div className="max-w-32 text-xs sm:max-w-none sm:text-sm">
        {/* data-dado-do-dono: nome como o dono cadastrou (o smoke ignora travessão e caixa alta nele). */}
        <span data-dado-do-dono className="font-bold text-ink-900">{linha.nome}</span>
        {linha.opcao && <span className="text-ink-600"> · {linha.opcao}</span>}
        <span className="block text-[11px] text-ink-500 sm:text-xs">{linha.sku}<span className="hidden sm:inline"> · {linha.categoria}</span></span>
      </div>
    </td>
    {/* Sem estoque também entra na tabela (catálogo inteiro); o painel marca
        para o dono saber o que está oferecendo sem ter na loja. */}
    <td className="px-3 py-2 text-right tabular-nums text-ink-600">{linha.estoque > 0 ? linha.estoque : <span className="whitespace-nowrap font-bold text-red-700">0 <span className="font-semibold">(sem estoque)</span></span>}</td>
    <td className="px-3 py-2 text-right tabular-nums text-ink-600">{formatPrice(linha.varejoCents)}</td>
    <td className="px-3 py-2 text-right tabular-nums text-ink-600">{formatPrice(linha.comDescontoCents)}</td>
    <td className="px-3 py-2">
      <form action={action} className="flex flex-nowrap items-center gap-2">
        <input type="hidden" name="chave" value={linha.chave} />
        <span className="relative shrink-0">
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-ink-400">R$</span>
          <input
            name="preco" value={texto} onChange={(event) => setTexto(event.target.value)} inputMode="decimal" autoComplete="off"
            placeholder="0,00" aria-label={`Preço especial para lojista de ${rotulo}`}
            aria-invalid={Boolean(erro) || undefined} aria-describedby={ajuda ? idAjuda : undefined}
            ref={(campo) => campo?.setCustomValidity(erro)}
            className={`h-11 w-28 rounded-lg border bg-white pl-8 pr-2 text-base tabular-nums outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-100 sm:text-sm ${erro ? "border-red-500" : "border-ink-200"}`}
          />
        </span>
        <BotaoDaLinha disabled={!mudou} aria-label={`Salvar preço especial de ${rotulo}`}>Salvar</BotaoDaLinha>
        {/* O próprio botão diz "tirar" no envio: mudar o campo antes de
            enviar não chegaria a tempo no FormData. formNoValidate: tirar
            vale mesmo com o campo inválido. */}
        {linha.especialCents !== null && (
          <BotaoDaLinha secundario name="acao" value="tirar" formNoValidate aria-label={`Tirar o preço especial de ${rotulo}`}>Tirar</BotaoDaLinha>
        )}
      </form>
      {ajuda && (
        <p id={idAjuda} role="status" className={`mt-1 max-w-72 text-xs ${ajuda.alerta ? "font-bold text-red-700" : "text-ink-500"}`}>{ajuda.texto}</p>
      )}
    </td>
    <td className="px-3 py-2 text-right text-base font-black tabular-nums text-ink-900">{formatPrice(linha.finalCents)}</td>
  </tr>;
}

/** Botão da linha que mostra "Salvando..." enquanto o formulário dela envia. */
function BotaoDaLinha({ secundario = false, children, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { secundario?: boolean }) {
  const { pending } = useFormStatus();
  return <button
    type="submit" disabled={pending || disabled} {...props}
    className={`h-11 shrink-0 rounded-lg px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${secundario ? "border border-ink-200 text-ink-700 hover:border-ink-400" : "bg-ink-900 text-white"}`}
  >
    {pending ? "Salvando..." : children}
  </button>;
}
