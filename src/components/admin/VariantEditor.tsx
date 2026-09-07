"use client";

import { useMemo, useState } from "react";
import type { AdminProductVariant } from "@/lib/admin/types";
import { formatPrice } from "@/lib/utils/format";

/**
 * Grade de variacoes da ficha do produto, no formato que o lojista ja conhece
 * da Shopee: um eixo (Cor, Voltagem, Tamanho) e uma linha por opcao com preco,
 * estoque e SKU proprios.
 *
 * Um eixo so, de proposito. A Shopee permite dois combinados (cor x tamanho),
 * o que multiplica as linhas; o catalogo daqui usa um por vez — cor OU
 * voltagem —, e um segundo eixo custaria muito mais do que entregaria hoje.
 *
 * Sai como JSON num input escondido porque a ficha e um `<form action={...}>`
 * comum, sem estado no servidor.
 */

interface LinhaEditavel {
  id: string;
  label: string;
  sku: string;
  price: string;
  stock: string;
  active: boolean;
  /** URL de uma das fotos do produto. Vazio = usa a imagem principal. */
  imageSrc: string;
}

const EIXOS_SUGERIDOS = ["Cor", "Voltagem", "Tamanho", "Modelo", "Sabor"];

const campo = "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-100";

/** SKU sugerido: DG-ELT-002-PRETO. Continua editavel. */
function sugerirSku(skuBase: string, label: string, usados: Set<string>): string {
  const sufixo = label.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12);
  if (!skuBase.trim() || !sufixo) return "";
  const base = `${skuBase.trim().toUpperCase()}-${sufixo}`;
  if (!usados.has(base)) return base;
  for (let n = 2; n < 50; n += 1) {
    const tentativa = `${base}-${n}`;
    if (!usados.has(tentativa)) return tentativa;
  }
  return base;
}

function linhaVazia(): LinhaEditavel {
  return { id: crypto.randomUUID(), label: "", sku: "", price: "", stock: "0", active: true, imageSrc: "" };
}

export function VariantEditor({
  skuBase,
  precoBase,
  variantAxis,
  variants,
  imagens = [],
  disponivel = true,
}: {
  skuBase: string;
  /** Preco do produto, usado como ponto de partida da primeira opcao. */
  precoBase: number;
  variantAxis?: string | null;
  variants?: AdminProductVariant[];
  /** Fotos ja enviadas do produto: sao elas que o lojista marca por cor. */
  imagens?: Array<{ src: string; alt: string }>;
  /** Falso enquanto a migracao de variacoes nao foi aplicada ao banco. */
  disponivel?: boolean;
}) {
  const iniciais = variants ?? [];
  const [ligado, setLigado] = useState(iniciais.length > 0);
  const [eixo, setEixo] = useState(variantAxis || "Cor");
  const [linhas, setLinhas] = useState<LinhaEditavel[]>(
    iniciais.length
      ? iniciais.map((item) => ({
          id: item.id,
          label: item.label,
          sku: item.sku,
          price: (item.price_cents / 100).toFixed(2),
          stock: String(item.stock),
          active: item.active,
          imageSrc: item.image_src ?? "",
        }))
      : [linhaVazia()],
  );

  /**
   * Ao ligar, a primeira opcao herda o preco do produto — o lojista acabou de
   * digitar esse valor logo acima e nao deve ter de repetir.
   */
  function ligar(marcado: boolean) {
    setLigado(marcado);
    if (!marcado) return;
    setLinhas((atual) => atual.length === 1 && !atual[0].price && precoBase > 0
      ? [{ ...atual[0], price: (precoBase / 100).toFixed(2) }]
      : atual);
  }

  const skusUsados = useMemo(() => new Set(linhas.map((linha) => linha.sku.toUpperCase()).filter(Boolean)), [linhas]);

  const validas = linhas.filter((linha) => linha.label.trim() && linha.sku.trim() && Number(linha.price) > 0);
  const ativas = validas.filter((linha) => linha.active);
  const estoqueTotal = ativas.reduce((soma, linha) => soma + (Number(linha.stock) || 0), 0);
  const menorPreco = ativas.length ? Math.min(...ativas.map((linha) => Math.round(Number(linha.price) * 100))) : 0;
  const rotulosRepetidos = new Set(
    validas.map((l) => l.label.trim().toLowerCase()).filter((rotulo, i, todos) => todos.indexOf(rotulo) !== i),
  );

  // Payload enviado no submit. Vazio = produto sem variacao.
  const payload = ligado && validas.length
    ? JSON.stringify({
        axis: eixo.trim() || "Variação",
        rows: validas.map((linha) => ({
          id: linha.id,
          label: linha.label.trim(),
          sku: linha.sku.trim().toUpperCase(),
          priceCents: Math.round(Number(linha.price) * 100),
          stock: Math.max(0, Math.trunc(Number(linha.stock) || 0)),
          active: linha.active,
          imageSrc: linha.imageSrc || null,
        })),
      })
    : "";

  function alterar(id: string, mudanca: Partial<LinhaEditavel>) {
    setLinhas((atual) => atual.map((linha) => linha.id === id ? { ...linha, ...mudanca } : linha));
  }

  function preencherSku(id: string, label: string) {
    setLinhas((atual) => atual.map((linha) => {
      if (linha.id !== id || linha.sku.trim()) return linha;
      const outros = new Set(atual.filter((item) => item.id !== id).map((item) => item.sku.toUpperCase()).filter(Boolean));
      return { ...linha, sku: sugerirSku(skuBase, label, outros) };
    }));
  }

  if (!disponivel) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <strong className="block">Variações ainda não estão disponíveis neste banco.</strong>
        <span className="mt-1 block text-xs">
          Falta aplicar a migração <code className="rounded bg-white px-1">202609060001_variacoes.sql</code> no Supabase.
          Até lá, cor e voltagem continuam como produtos separados.
        </span>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-ink-200 bg-white p-5">
      <input type="hidden" name="variantRows" value={payload} />

      <label className="flex items-start gap-3">
        <input type="checkbox" checked={ligado} onChange={(event) => ligar(event.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>
          <span className="block text-sm font-black text-ink-900">Este produto tem variações</span>
          <span className="block text-xs text-ink-500">
            Cor, voltagem ou tamanho — cada opção com preço, estoque e SKU próprios. É o que evita cadastrar o mesmo produto três vezes.
          </span>
        </span>
      </label>

      {ligado && (
        <div className="mt-5 space-y-4">
          <div className="max-w-xs">
            <label htmlFor="variant-axis" className="block text-xs font-bold text-ink-600">Tipo de variação</label>
            <input id="variant-axis" list="eixos-sugeridos" value={eixo} onChange={(event) => setEixo(event.target.value)} className={`${campo} mt-1`} placeholder="Cor" />
            <datalist id="eixos-sugeridos">
              {EIXOS_SUGERIDOS.map((item) => <option key={item} value={item} />)}
            </datalist>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="pb-2 pr-3 font-bold">{eixo.trim() || "Opção"}</th>
                  <th className="pb-2 pr-3 font-bold">Preço</th>
                  <th className="pb-2 pr-3 font-bold">Estoque</th>
                  <th className="pb-2 pr-3 font-bold">SKU</th>
                  <th className="pb-2 pr-3 font-bold">Foto</th>
                  <th className="pb-2 pr-3 font-bold">Ativa</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => {
                  const skuRepetido = Boolean(linha.sku) && linhas.filter((item) => item.sku.toUpperCase() === linha.sku.toUpperCase()).length > 1;
                  const rotuloRepetido = rotulosRepetidos.has(linha.label.trim().toLowerCase());
                  return (
                    <tr key={linha.id} className="align-top">
                      <td className="py-1.5 pr-3">
                        <input
                          value={linha.label}
                          onChange={(event) => alterar(linha.id, { label: event.target.value })}
                          onBlur={(event) => preencherSku(linha.id, event.target.value)}
                          placeholder="Preto"
                          className={`${campo} ${rotuloRepetido ? "border-red-300 bg-red-50" : ""}`}
                          aria-label={`Nome da opção ${linha.label || "nova"}`}
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input type="number" min={0} step="0.01" value={linha.price}
                          onChange={(event) => alterar(linha.id, { price: event.target.value })}
                          placeholder="119,90" className={`${campo} w-28`} aria-label="Preço da opção" />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input type="number" min={0} value={linha.stock}
                          onChange={(event) => alterar(linha.id, { stock: event.target.value })}
                          className={`${campo} w-24`} aria-label="Estoque da opção" />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input value={linha.sku}
                          onChange={(event) => alterar(linha.id, { sku: event.target.value.toUpperCase() })}
                          placeholder={sugerirSku(skuBase, linha.label, skusUsados) || "DG-ELT-002-PRETO"}
                          className={`${campo} font-mono text-xs ${skuRepetido ? "border-red-300 bg-red-50" : ""}`}
                          aria-label="SKU da opção" />
                      </td>
                      <td className="py-1.5 pr-3">
                        {imagens.length === 0 ? (
                          <span className="block pt-2.5 text-[11px] text-ink-400">envie fotos abaixo</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <select value={linha.imageSrc} onChange={(event) => alterar(linha.id, { imageSrc: event.target.value })}
                              className={`${campo} w-32 text-xs`} aria-label={`Foto da opção ${linha.label || "nova"}`}>
                              <option value="">Principal</option>
                              {imagens.map((foto, posicao) => <option key={foto.src} value={foto.src}>Foto {posicao + 1}</option>)}
                            </select>
                            {linha.imageSrc && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={linha.imageSrc} alt="" className="h-9 w-9 shrink-0 rounded border border-ink-200 object-cover" />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 pr-3">
                        <input type="checkbox" checked={linha.active} onChange={(event) => alterar(linha.id, { active: event.target.checked })}
                          className="mt-2.5 h-4 w-4" aria-label="Opção ativa na loja" />
                      </td>
                      <td className="py-1.5">
                        {linhas.length > 1 && (
                          <button type="button" onClick={() => setLinhas((atual) => atual.filter((item) => item.id !== linha.id))}
                            className="mt-2 text-xs font-bold text-ink-400 underline">remover</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={() => setLinhas((atual) => [...atual, linhaVazia()])}
            className="rounded-lg border border-ink-300 px-3 py-2 text-xs font-extrabold text-ink-700">
            + Adicionar opção
          </button>

          <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
            {validas.length === 0
              ? "Preencha nome, preço e SKU de pelo menos uma opção — sem isso o produto será salvo sem variação."
              : <>
                  <strong>{ativas.length} opção(ões) ativa(s)</strong> · estoque total <strong>{estoqueTotal}</strong> · a partir de <strong>{formatPrice(menorPreco)}</strong>.
                  {" "}O estoque e o preço do produto passam a vir daqui.
                </>}
            {rotulosRepetidos.size > 0 && <span className="mt-1 block font-bold text-red-700">Há opções com o mesmo nome. Ajuste antes de salvar.</span>}
          </p>
        </div>
      )}
    </section>
  );
}
