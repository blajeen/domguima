"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { salvarPrecoLojistaAction, salvarPrecosLojistaEmLoteAction, type ResultadoLoteLojistas } from "@/app/painel/actions";
import { descontoEquivalente, lerDinheiroDigitado, validarPrecoEspecial, type EspecialForaDaTabela, type ItemDoLote, type LinhaLojista } from "@/lib/admin/lojistas";
import type { ActionState } from "@/lib/admin/types";
import { formatPrice, normalize } from "@/lib/utils/format";
import { SubmitButton } from "../FormControls";

/**
 * Preço especial por produto (ou por opção): o preço fixo daquele item para
 * lojista, acima ou abaixo do desconto geral. Cada linha tem o próprio
 * Salvar; o "Salvar todos" no pé grava de uma vez tudo o que foi digitado.
 * Vazio + Salvar, ou "Tirar", volta a linha para o desconto geral.
 *
 * O que foi digitado e ainda não salvo fica aqui (`rascunhos`), e não em cada
 * linha: o "Salvar todos" enxerga tudo, inclusive as linhas que a busca ou o
 * filtro escondem (atributo hidden, sem tirar da tela).
 */
export function PrecosEspeciais({ linhas, descontoRotulo, mostrarPrecoSite }: {
  linhas: LinhaLojista[];
  descontoRotulo: string;
  /** Com o preço do site oculto (padrão), ele some também desta tabela: o dono pode mostrar a tela a outro lojista. */
  mostrarPrecoSite: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [soEspeciais, setSoEspeciais] = useState(false);
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  // Resultado do último "Salvar todos" que o dono ainda não viu: a barra
  // continua presa com ele até a próxima digitação.
  const [loteNaoVisto, setLoteNaoVisto] = useState(false);
  const visiveis = useMemo(() => {
    const termo = normalize(busca);
    return new Set(linhas.filter((linha) => (!soEspeciais || linha.especialCents !== null)
      && (!termo || normalize(`${linha.nome} ${linha.opcao ?? ""} ${linha.sku} ${linha.categoria}`).includes(termo))).map((linha) => linha.chave));
  }, [busca, linhas, soEspeciais]);
  const especiais = linhas.filter((linha) => linha.especialCents !== null).length;

  const digitar = useCallback((chave: string, texto: string) => {
    setRascunhos((antes) => ({ ...antes, [chave]: texto }));
    setLoteNaoVisto(false);
  }, []);
  // Só apaga o rascunho que ainda é o texto enviado: o que o dono digitou
  // enquanto salvava continua na tela.
  const limpar = useCallback((enviados: readonly ItemDoLote[]) => setRascunhos((antes) => {
    const depois = { ...antes };
    for (const { chave, texto } of enviados) if (depois[chave] === texto) delete depois[chave];
    return depois;
  }), []);

  // Alteradas: o digitado difere do salvo pelo valor ("180" e "180,00" são
  // iguais). Rascunho de linha que saiu da tabela não conta.
  const alteradas = linhas.filter((linha) => linha.chave in rascunhos && mudouPreco(rascunhos[linha.chave], linha.especialCents));
  const invalidas = alteradas.filter((linha) => !validarPrecoEspecial(rascunhos[linha.chave]).ok);
  const conferir = alteradas.filter((linha) => {
    const lido = validarPrecoEspecial(rascunhos[linha.chave]);
    return lido.ok && lido.cents !== null && dicaDoPreco(lido.cents, linha, mostrarPrecoSite, descontoRotulo).alerta;
  });
  const escondidas = (lista: LinhaLojista[]) => lista.filter((linha) => !visiveis.has(linha.chave)).length;
  const onde = busca.trim() && soEspeciais ? "pela busca e pelo filtro" : busca.trim() ? "pela busca" : "pelo filtro";
  const [lote, salvarLote] = useActionState(async (anterior: ResultadoLoteLojistas, dados: FormData) => {
    const resposta = await salvarPrecosLojistaEmLoteAction(anterior, dados);
    const enviados = JSON.parse(String(dados.get("itens") ?? "[]")) as ItemDoLote[];
    const salvas = new Set(resposta.salvas ?? []);
    limpar(enviados.filter((item) => salvas.has(item.chave)));
    setLoteNaoVisto(true);
    return resposta;
  }, {});
  const presa = alteradas.length > 0 || (loteNaoVisto && Boolean(lote.message));

  // Com a barra presa, a rolagem até o campo em foco (Tab) para acima dela
  // (admin.css, html[data-barra-lojistas]), como na barra de compra do site.
  useEffect(() => {
    if (!presa) return;
    const html = document.documentElement;
    html.setAttribute("data-barra-lojistas", "");
    return () => html.removeAttribute("data-barra-lojistas");
  }, [presa]);

  const aviso = (() => {
    if (invalidas.length) {
      const fora = escondidas(invalidas);
      return { texto: `${invalidas.length === 1 ? "1 preço não está" : `${invalidas.length} preços não estão`} em reais (ex.: 89,90)${fora ? `, ${fora === 1 ? "escondido" : `${fora} escondidos`} ${onde}` : ""}. Corrija para salvar todos.`, alerta: true };
    }
    if (loteNaoVisto && lote.message) return { texto: lote.message, alerta: !lote.ok };
    if (!alteradas.length) return { texto: "Digite os preços nas linhas e salve todos de uma vez.", alerta: false };
    const fora = escondidas(alteradas);
    const conferirFora = escondidas(conferir);
    return {
      texto: `${alteradas.length === 1 ? "1 preço digitado e não salvo" : `${alteradas.length} preços digitados e não salvos`}${fora ? ` (${fora} ${fora === 1 ? "escondido" : "escondidos"} ${onde})` : ""}.`
        + (conferir.length ? ` ${conferir.length === 1 ? "1 pede" : `${conferir.length} pedem`} conferência${conferirFora ? ` (${conferirFora} ${conferirFora === 1 ? "escondido" : "escondidos"} ${onde})` : ""}: veja o aviso em vermelho na linha.` : ""),
      alerta: false,
    };
  })();
  const algoEscondido = escondidas(alteradas) > 0;

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
    <p className="mt-2 text-xs text-ink-500" aria-live="polite">{visiveis.size} de {linhas.length} itens publicados com estoque.</p>
    <div className="mt-3 overflow-x-auto rounded-xl border border-ink-100">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-ink-50 text-xs text-ink-500">
          <tr>
            {/* A 1ª coluna fica presa ao rolar a tabela para o lado: no
                celular, quem edita o preço continua vendo de qual produto é. */}
            <th scope="col" className="sticky left-0 z-10 bg-ink-50 px-3 py-2 font-bold">Produto</th>
            <th scope="col" className="px-3 py-2 text-right font-bold">Estoque</th>
            {mostrarPrecoSite && <th scope="col" className="px-3 py-2 text-right font-bold">À vista no site</th>}
            <th scope="col" className="px-3 py-2 text-right font-bold">Com {descontoRotulo}</th>
            <th scope="col" className="px-3 py-2 font-bold">Preço especial</th>
            <th scope="col" className="px-3 py-2 text-right font-bold">No catálogo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {linhas.map((linha) => <LinhaPreco
            key={linha.chave} linha={linha} descontoRotulo={descontoRotulo} mostrarPrecoSite={mostrarPrecoSite} oculta={!visiveis.has(linha.chave)}
            texto={rascunhos[linha.chave] ?? textoDoPreco(linha.especialCents)} digitar={digitar} limpar={limpar}
          />)}
        </tbody>
      </table>
      {visiveis.size === 0 && <p className="px-3 py-6 text-center text-sm text-ink-500">Nenhum item encontrado.</p>}
    </div>
    {/* "Salvar todos": presa no pé da tela enquanto houver preço digitado e
        não salvo (ou um resultado que o dono ainda não viu), para não ter de
        rolar a tabela inteira até o fim. */}
    <form action={salvarLote} className={`${presa ? "sticky bottom-0 z-20 border-gold-300 shadow-card" : "border-ink-100"} mt-3 flex flex-wrap items-center gap-3 rounded-xl border bg-white px-3 py-3`}>
      <input type="hidden" name="itens" value={JSON.stringify(alteradas.map((linha) => ({ chave: linha.chave, texto: rascunhos[linha.chave] })))} />
      <SubmitButton pendingLabel="Salvando todos..." disabled={!alteradas.length || invalidas.length > 0}>
        {alteradas.length ? `Salvar todos (${alteradas.length})` : "Salvar todos"}
      </SubmitButton>
      {algoEscondido && (
        <button type="button" onClick={() => { setBusca(""); setSoEspeciais(false); }} className="min-h-11 rounded-lg border border-ink-200 px-3 text-xs font-bold text-ink-700 hover:border-ink-400">Mostrar todos</button>
      )}
      <p className={`min-w-0 flex-1 text-xs ${aviso.alerta ? "font-bold text-red-700" : "text-ink-600"}`} aria-live="polite">{aviso.texto}</p>
    </form>
  </div>;
}

/** Resposta da linha e o que ela se refere: o texto enviado, se foi um Tirar e o preço que ficou salvo. */
type EstadoLinha = ActionState & { enviado?: string; tirou?: boolean; salvoCents?: number | null };

/** Chama a action e guarda junto o que foi enviado. */
async function enviarPreco(anterior: EstadoLinha, dados: FormData): Promise<EstadoLinha> {
  const resposta = await salvarPrecoLojistaAction(anterior, dados);
  const tirou = dados.get("acao") === "tirar";
  const enviado = tirou ? "" : String(dados.get("preco") ?? "");
  return { ...resposta, tirou, enviado, salvoCents: enviado.trim() ? lerDinheiroDigitado(enviado) : null };
}

/** O digitado difere do salvo? Pelo valor, não pelo texto; texto que não vira preço conta como mudado, para o erro aparecer. */
function mudouPreco(texto: string, salvoCents: number | null): boolean {
  if (!texto.trim()) return salvoCents !== null;
  const cents = lerDinheiroDigitado(texto);
  return cents === null || cents !== salvoCents;
}

/**
 * Dica de um preço especial. Não trava nada ("sem essa trava"): só avisa.
 * Acima do preço à vista do site é alerta (quase sempre erro de digitação);
 * com o preço do site oculto, o alerta não cita o site. Acima do preço com o
 * desconto geral é informação (arredondar R$ 179,91 para R$ 180,00). Abaixo:
 * com o preço do site à vista, quanto fica abaixo dele em %; com ele oculto,
 * a diferença em reais para o preço com o desconto geral. A partir de 50%
 * abaixo, pede para conferir: pega "1,99" digitado no lugar de "199".
 */
function dicaDoPreco(cents: number, linha: LinhaLojista, mostrarPrecoSite: boolean, descontoRotulo: string): { texto: string; alerta: boolean } {
  if (cents > linha.varejoCents) {
    return mostrarPrecoSite
      ? { texto: "Confira: fica acima do preço à vista do site.", alerta: true }
      : { texto: `Confira: fica ${formatPrice(cents - linha.comDescontoCents)} acima do preço com ${descontoRotulo}.`, alerta: true };
  }
  if (cents > linha.comDescontoCents) return { texto: `Fica ${formatPrice(cents - linha.comDescontoCents)} acima do preço com ${descontoRotulo}.`, alerta: false };
  if (cents === linha.comDescontoCents) return { texto: `Igual ao preço com ${descontoRotulo}.`, alerta: false };
  if (mostrarPrecoSite) {
    const abaixo = descontoEquivalente(cents, linha.varejoCents);
    return { texto: `${abaixo >= 50 ? "Confira: dá" : "Dá"} ${abaixo}% abaixo do preço no site.`, alerta: abaixo >= 50 };
  }
  const abaixo = descontoEquivalente(cents, linha.comDescontoCents);
  const porcento = abaixo >= 1 ? ` (${abaixo}%)` : "";
  return { texto: `${abaixo >= 50 ? "Confira: fica" : "Fica"} ${formatPrice(linha.comDescontoCents - cents)} abaixo do preço com ${descontoRotulo}${porcento}.`, alerta: abaixo >= 50 };
}

/** O que a linha diz sobre o preço já salvo: alerta de conferir continua; acima do desconto geral vira nota de "preço fixo". */
function dicaDoSalvo(linha: LinhaLojista, mostrarPrecoSite: boolean, descontoRotulo: string): { texto: string; alerta: boolean } | null {
  if (linha.especialCents === null) return null;
  const dica = dicaDoPreco(linha.especialCents, linha, mostrarPrecoSite, descontoRotulo);
  if (dica.alerta) return dica;
  if (linha.especialCents > linha.comDescontoCents) return { texto: `Preço fixo: fica ${formatPrice(linha.especialCents - linha.comDescontoCents)} acima do preço com ${descontoRotulo}.`, alerta: false };
  return null;
}

function textoDoPreco(cents: number | null): string {
  return cents !== null ? (cents / 100).toFixed(2).replace(".", ",") : "";
}

/**
 * Uma linha, com chave estável: depois de Salvar ou Tirar ela não remonta, o
 * foco fica no botão e a confirmação aparece. O texto vem de cima (rascunho,
 * ou o preço salvo); salvou, o rascunho sai e a linha mostra o salvo.
 */
function LinhaPreco({ linha, descontoRotulo, mostrarPrecoSite, oculta, texto, digitar, limpar }: {
  linha: LinhaLojista;
  descontoRotulo: string;
  mostrarPrecoSite: boolean;
  oculta: boolean;
  texto: string;
  digitar: (chave: string, texto: string) => void;
  limpar: (enviados: readonly ItemDoLote[]) => void;
}) {
  const [state, action] = useActionState(async (anterior: EstadoLinha, dados: FormData) => {
    const resposta = await enviarPreco(anterior, dados);
    if (resposta.ok) limpar([{ chave: linha.chave, texto: String(dados.get("preco") ?? "") }]);
    return resposta;
  }, {});

  const mudou = mudouPreco(texto, linha.especialCents);
  const validacao = validarPrecoEspecial(texto);
  const erro = mudou && !validacao.ok ? validacao.mensagem : "";
  // A resposta da linha só vale enquanto se refere ao que está na tela: um
  // "Salvar todos" depois dela muda o preço salvo, e a mensagem antiga (de
  // outro preço, ou uma falha) não pode continuar embaixo do campo.
  const falhou = !state.ok && state.message && (state.tirou ? linha.especialCents !== null && !mudou : mudou && state.enviado === texto) ? state.message : "";
  const confirmou = state.ok && state.message && !mudou && state.salvoCents === linha.especialCents ? state.message : "";
  const idAjuda = `preco-${linha.chave.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const rotulo = linha.opcao ? `${linha.nome} · ${linha.opcao}` : linha.nome;
  const ativo = linha.especialCents !== null;

  // Uma mensagem por vez, na ordem do que importa agora.
  const salvo = mudou ? null : dicaDoSalvo(linha, mostrarPrecoSite, descontoRotulo);
  const ajuda: { texto: string; alerta: boolean } | null = erro ? { texto: erro, alerta: true }
    : falhou ? { texto: falhou, alerta: true }
    : mudou && validacao.ok && validacao.cents !== null ? dicaDoPreco(validacao.cents, linha, mostrarPrecoSite, descontoRotulo)
    : salvo?.alerta ? salvo
    : confirmou ? { texto: confirmou, alerta: false }
    : salvo;

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
    <td className="px-3 py-2 text-right tabular-nums text-ink-600">{linha.estoque}</td>
    {mostrarPrecoSite && <td className="px-3 py-2 text-right tabular-nums text-ink-600">{formatPrice(linha.varejoCents)}</td>}
    <td className="px-3 py-2 text-right tabular-nums text-ink-600">{formatPrice(linha.comDescontoCents)}</td>
    <td className="px-3 py-2">
      <form action={action} className="flex flex-nowrap items-center gap-2">
        <input type="hidden" name="chave" value={linha.chave} />
        <span className="relative shrink-0">
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-ink-400">R$</span>
          <input
            name="preco" value={texto} onChange={(event) => digitar(linha.chave, event.target.value)} inputMode="decimal" autoComplete="off"
            placeholder="0,00" aria-label={`Preço especial para lojista de ${rotulo}`}
            aria-invalid={Boolean(erro) || undefined} aria-describedby={ajuda ? idAjuda : undefined}
            ref={(campo) => campo?.setCustomValidity(erro)}
            className={`h-11 w-28 rounded-lg border bg-white pl-8 pr-2 text-base tabular-nums outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-100 sm:text-sm ${erro ? "border-red-500" : mudou ? "border-gold-500" : "border-ink-200"}`}
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

/**
 * Preços especiais guardados de itens que não estão na tabela agora (esgotou,
 * saiu do site...). Eles voltam a valer quando o item voltar; aqui o dono vê
 * quais são e tira os que não servem mais, em vez de um preço antigo voltar
 * sozinho no PDF.
 */
export function EspeciaisForaDaTabela({ itens }: { itens: EspecialForaDaTabela[] }) {
  if (!itens.length) return null;
  return <div className="mb-4 rounded-lg border border-ink-200 bg-ink-50 px-3 py-3 text-sm">
    <p className="font-bold text-ink-900">{itens.length === 1 ? "1 preço especial guardado" : `${itens.length} preços especiais guardados`} de itens que não estão na tabela</p>
    <p className="mt-0.5 text-xs text-ink-600">Voltam a valer quando o item voltar (por exemplo, quando você repor o estoque). Tire os que não servem mais.</p>
    <ul className="mt-2 divide-y divide-ink-200">
      {itens.map((item) => <EspecialGuardado key={item.chave} item={item} />)}
    </ul>
  </div>;
}

function EspecialGuardado({ item }: { item: EspecialForaDaTabela }) {
  const [state, action] = useActionState(enviarPreco, {});
  return <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
    <span>
      {/* data-dado-do-dono: nome como o dono cadastrou (o smoke ignora travessão e caixa alta nele). */}
      <span data-dado-do-dono className="font-semibold text-ink-900">{item.rotulo}</span>
      <span className="text-xs text-ink-600"> ({item.motivo}): </span>
      <span className="font-bold tabular-nums text-ink-900">{formatPrice(item.cents)}</span>
    </span>
    <form action={action}>
      <input type="hidden" name="chave" value={item.chave} />
      <BotaoDaLinha secundario name="acao" value="tirar" aria-label={`Tirar o preço especial guardado de ${item.rotulo}`}>Tirar</BotaoDaLinha>
    </form>
    {state.message && !state.ok && <p role="status" className="w-full text-xs font-bold text-red-700">{state.message}</p>}
  </li>;
}
