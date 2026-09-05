"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createBulkOrdersAction, type BulkImportResult } from "@/app/painel/actions";
import { bulkRequestId, matchBulkProduct, parseBulkSalesText, type BulkMatchConfidence } from "@/lib/admin/bulk-orders";
import type { SellerRecord } from "@/lib/admin/types";
import { formatPrice } from "@/lib/utils/format";
import type { OrderProductOption } from "./OrderComposer";

/** Linha da conferencia: o que veio da mensagem + a decisao do operador. */
interface LinhaConferida {
  key: string;
  raw: string;
  nomeLido: string;
  quantity: number;
  quantidadeAssumida: boolean;
  productId: string;
  unitPriceCents: number;
  confidence: BulkMatchConfidence;
  alternativas: Array<{ productId: string; name: string; sku: string; stock: number; priceCents: number; score: number }>;
}

interface BlocoConferido {
  key: string;
  channelLabel: string;
  customerName: string;
  date: string | null;
  paid: boolean;
  linhas: LinhaConferida[];
  ignoradas: string[];
}

const CANAL_ROTULO: Record<string, string> = {
  retirada: "Retirada",
  entrega: "Entrega",
  shopee: "Shopee",
  mercado_livre: "Mercado Livre",
  outro: "Sem canal",
};

const EXEMPLO = `RETIRADA
FLAVIN
01 SMART TV SAMSUNG 75U8600F
PAGO

SHOPEE 04-09

01 MICRO-ONDAS ELECTROLUX ME36B 110V
02 CLIMATIZADOR BRITANIA BCL05A 220V`;

const campo = "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-100";

export function BulkOrderImporter({ products, sellers }: { products: OrderProductOption[]; sellers: SellerRecord[] }) {
  const [texto, setTexto] = useState("");
  const [sellerId, setSellerId] = useState(sellers.find((seller) => seller.active)?.id ?? "");
  const [blocos, setBlocos] = useState<BlocoConferido[] | null>(null);
  const [resultado, setResultado] = useState<BulkImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // O localizador precisa de {id, name, sku, stock, price_cents}; a pagina ja
  // entrega nesse formato. Memorizado para o indice do catalogo ser montado
  // uma vez so, e nao a cada linha da mensagem.
  const catalogo = useMemo(() => products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock, price_cents: p.price_cents })), [products]);

  function interpretar() {
    setResultado(null);
    const lidos = parseBulkSalesText(texto);
    setBlocos(lidos.map((bloco, indice) => {
      const rotulo = bloco.header || CANAL_ROTULO[bloco.channel] || "Lançamento";
      return {
        key: `${bulkRequestId(bloco)}-${indice}`,
        channelLabel: rotulo,
        customerName: bloco.customerName || rotulo,
        date: bloco.date,
        paid: bloco.paid,
        ignoradas: bloco.ignored,
        linhas: bloco.items.map((item, posicao) => {
          const match = matchBulkProduct(item.name, catalogo);
          return {
            key: `${indice}-${posicao}`,
            raw: item.raw,
            nomeLido: item.name,
            quantity: item.quantity,
            quantidadeAssumida: item.impliedQuantity,
            productId: match.confidence === "alta" ? match.best!.productId : "",
            unitPriceCents: match.confidence === "alta" ? match.best!.priceCents : 0,
            confidence: match.confidence,
            alternativas: match.alternatives,
          };
        }),
      };
    }));
  }

  function alterarLinha(blocoKey: string, linhaKey: string, mudanca: Partial<LinhaConferida>) {
    setBlocos((atual) => atual?.map((bloco) => bloco.key !== blocoKey ? bloco : {
      ...bloco,
      linhas: bloco.linhas.map((linha) => linha.key !== linhaKey ? linha : { ...linha, ...mudanca }),
    }) ?? null);
  }

  function alterarBloco(blocoKey: string, mudanca: Partial<BlocoConferido>) {
    setBlocos((atual) => atual?.map((bloco) => bloco.key === blocoKey ? { ...bloco, ...mudanca } : bloco) ?? null);
  }

  function removerLinha(blocoKey: string, linhaKey: string) {
    setBlocos((atual) => atual?.map((bloco) => bloco.key !== blocoKey ? bloco : {
      ...bloco, linhas: bloco.linhas.filter((linha) => linha.key !== linhaKey),
    }).filter((bloco) => bloco.linhas.length) ?? null);
  }

  function escolherProduto(blocoKey: string, linhaKey: string, productId: string) {
    const produto = catalogo.find((item) => item.id === productId);
    alterarLinha(blocoKey, linhaKey, {
      productId,
      unitPriceCents: produto ? produto.price_cents : 0,
      confidence: produto ? "alta" : "nenhuma",
    });
  }

  const prontos = (blocos ?? []).map((bloco) => ({
    bloco,
    linhas: bloco.linhas.filter((linha) => linha.productId && linha.unitPriceCents > 0),
  })).filter((item) => item.linhas.length);

  const pendentes = (blocos ?? []).reduce((soma, bloco) => soma + bloco.linhas.filter((linha) => !linha.productId).length, 0);
  const totalCentavos = prontos.reduce((soma, { linhas }) => soma + linhas.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0), 0);
  const totalUnidades = prontos.reduce((soma, { linhas }) => soma + linhas.reduce((s, l) => s + l.quantity, 0), 0);

  function gravar() {
    if (!prontos.length) return;

    // O requestId sai do conteudo ja resolvido (produtos e quantidades), entao
    // colar a mesma mensagem de novo cai no mesmo id e o banco recusa duplicar.
    const enviados = prontos.map(({ bloco, linhas }) => ({
      blocoKey: bloco.key,
      requestId: bulkRequestId({
        channel: bloco.channelLabel,
        date: bloco.date,
        customerName: bloco.customerName,
        items: linhas.map((linha) => ({ quantity: linha.quantity, name: linha.productId })),
      }),
      channelLabel: bloco.channelLabel,
      customerName: bloco.customerName,
      date: bloco.date,
      paid: bloco.paid,
      items: linhas.map((linha) => ({ productId: linha.productId, quantity: linha.quantity, unitPriceCents: linha.unitPriceCents })),
    }));

    startTransition(async () => {
      const saida = await createBulkOrdersAction(sellerId, enviados.map((item) => ({
        requestId: item.requestId, channelLabel: item.channelLabel, customerName: item.customerName,
        date: item.date, paid: item.paid, items: item.items,
      })));
      setResultado(saida);
      // Some da tela so o que entrou; o que falhou fica para corrigir.
      const gravados = new Set(saida.created.map((item) => item.requestId));
      const chavesGravadas = new Set(enviados.filter((item) => gravados.has(item.requestId)).map((item) => item.blocoKey));
      if (chavesGravadas.size) setBlocos((atual) => atual?.filter((bloco) => !chavesGravadas.has(bloco.key)) ?? null);
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <label htmlFor="mensagens" className="block text-xs font-bold text-ink-600">Cole as mensagens do grupo</label>
        <p className="mt-1 text-xs text-ink-500">
          Pode colar a semana inteira de uma vez. Cada <strong>RETIRADA</strong>, <strong>ENTREGA</strong>, <strong>SHOPEE</strong> ou <strong>MERCADO LIVRE</strong> vira um pedido.
          Os itens podem vir com quantidade na frente (<code className="rounded bg-ink-50 px-1">02 MIXER…</code>) ou um por linha, que aí conta 1 unidade.
        </p>
        <textarea
          id="mensagens"
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          rows={10}
          placeholder={EXEMPLO}
          className={`${campo} mt-3 font-mono text-xs leading-relaxed`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={interpretar} disabled={!texto.trim()} className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-40">
            Interpretar mensagens
          </button>
          {blocos && <span className="text-xs text-ink-500">{blocos.length} lançamento(s) lido(s)</span>}
        </div>
      </section>

      {resultado && (
        <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${resultado.ok ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          <p className="font-bold">{resultado.message}</p>
          {resultado.created.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs">
              {resultado.created.map((item) => <li key={item.requestId}>✓ {item.number} — {item.customerName}</li>)}
            </ul>
          )}
          {resultado.failed.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs">
              {resultado.failed.map((item) => <li key={item.requestId}>✗ {item.channelLabel}: {item.message}</li>)}
            </ul>
          )}
          {resultado.created.length > 0 && <Link href="/painel/pedidos" className="mt-2 inline-block font-bold underline">Ver pedidos</Link>}
        </div>
      )}

      {blocos && blocos.length === 0 && (
        <p className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
          Não reconheci nenhum lançamento nesse texto. Confira se as mensagens têm um cabeçalho como <strong>RETIRADA</strong> ou <strong>SHOPEE 04-09</strong>.
        </p>
      )}

      {blocos?.map((bloco) => (
        <section key={bloco.key} className="rounded-xl border border-ink-200 bg-white">
          <header className="flex flex-wrap items-end gap-3 border-b border-ink-100 px-5 py-4">
            <div className="min-w-[10rem] flex-1">
              <label htmlFor={`cliente-${bloco.key}`} className="block text-xs font-bold text-ink-600">Cliente / canal</label>
              <input id={`cliente-${bloco.key}`} value={bloco.customerName} onChange={(e) => alterarBloco(bloco.key, { customerName: e.target.value })} className={`${campo} mt-1`} />
            </div>
            <div>
              <label htmlFor={`data-${bloco.key}`} className="block text-xs font-bold text-ink-600">Data da venda</label>
              <input id={`data-${bloco.key}`} type="date" value={bloco.date ?? ""} onChange={(e) => alterarBloco(bloco.key, { date: e.target.value || null })} className={`${campo} mt-1`} />
            </div>
            <p className="pb-2 text-xs text-ink-500">{bloco.channelLabel}{bloco.paid ? " · pago" : ""}</p>
          </header>

          <ul className="divide-y divide-ink-100">
            {bloco.linhas.map((linha) => {
              const produto = catalogo.find((item) => item.id === linha.productId);
              const semEstoque = produto ? produto.stock < linha.quantity : false;
              return (
                <li key={linha.key} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-mono text-xs text-ink-500">{linha.raw}</p>
                    <button type="button" onClick={() => removerLinha(bloco.key, linha.key)} className="text-xs font-bold text-ink-400 underline">remover</button>
                  </div>

                  <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_5rem_8rem]">
                    <div>
                      <label htmlFor={`prod-${linha.key}`} className="sr-only">Produto do catálogo</label>
                      <select
                        id={`prod-${linha.key}`}
                        value={linha.productId}
                        onChange={(e) => escolherProduto(bloco.key, linha.key, e.target.value)}
                        className={`${campo} ${linha.productId ? "" : "border-red-300 bg-red-50"}`}
                      >
                        <option value="">— escolha o produto —</option>
                        {linha.alternativas.map((alternativa) => (
                          <option key={alternativa.productId} value={alternativa.productId}>
                            {alternativa.name} · estoque {alternativa.stock}
                          </option>
                        ))}
                        {linha.productId && !linha.alternativas.some((a) => a.productId === linha.productId) && produto && (
                          <option value={produto.id}>{produto.name} · estoque {produto.stock}</option>
                        )}
                        <optgroup label="Catálogo completo">
                          {catalogo.map((item) => <option key={`todos-${item.id}`} value={item.id}>{item.name} · estoque {item.stock}</option>)}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`qtd-${linha.key}`} className="sr-only">Quantidade</label>
                      <input id={`qtd-${linha.key}`} type="number" min={1} value={linha.quantity}
                        onChange={(e) => alterarLinha(bloco.key, linha.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        className={`${campo} ${linha.quantidadeAssumida ? "border-amber-300" : ""}`} />
                    </div>
                    <div>
                      <label htmlFor={`valor-${linha.key}`} className="sr-only">Valor unitário em reais</label>
                      <input id={`valor-${linha.key}`} type="number" min={0} step="0.01"
                        value={linha.unitPriceCents ? (linha.unitPriceCents / 100).toFixed(2) : ""}
                        placeholder="valor un."
                        onChange={(e) => alterarLinha(bloco.key, linha.key, { unitPriceCents: Math.max(0, Math.round(Number(e.target.value) * 100) || 0) })}
                        className={campo} />
                    </div>
                  </div>

                  <p className="mt-1.5 text-xs">
                    {linha.confidence === "alta" && linha.productId && <span className="text-green-700">Produto reconhecido.</span>}
                    {linha.confidence === "duvidosa" && <span className="font-bold text-amber-700">Confira: há mais de um produto parecido.</span>}
                    {linha.confidence === "nenhuma" && !linha.productId && <span className="font-bold text-red-700">Não achei esse produto no catálogo. Escolha na lista ou remova a linha.</span>}
                    {linha.quantidadeAssumida && <span className="ml-2 text-amber-700">Quantidade assumida como 1.</span>}
                    {semEstoque && <span className="ml-2 font-bold text-red-700">Estoque atual ({produto?.stock}) menor que a quantidade.</span>}
                  </p>
                </li>
              );
            })}
          </ul>

          {bloco.ignoradas.length > 0 && (
            <p className="border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
              Linhas não usadas: {bloco.ignoradas.join(" · ")}
            </p>
          )}
        </section>
      ))}

      {blocos && blocos.length > 0 && (
        <section className="sticky bottom-0 rounded-xl border border-ink-200 bg-white p-5 shadow-lg">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="vendedor" className="block text-xs font-bold text-ink-600">Vendedor</label>
              <select id="vendedor" value={sellerId} onChange={(e) => setSellerId(e.target.value)} className={`${campo} mt-1`}>
                {sellers.filter((seller) => seller.active).map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
              </select>
            </div>
            <p className="flex-1 text-sm text-ink-600">
              <strong>{prontos.length}</strong> pedido(s) prontos · {totalUnidades} unidade(s) · {formatPrice(totalCentavos)}
              {pendentes > 0 && <span className="block font-bold text-red-700">{pendentes} linha(s) ainda sem produto — elas não serão gravadas.</span>}
            </p>
            <button type="button" onClick={gravar} disabled={isPending || !prontos.length || !sellerId} className="rounded-lg bg-gold-400 px-5 py-3 text-sm font-extrabold text-ink-950 disabled:opacity-40">
              {isPending ? "Gravando..." : `Gerar ${prontos.length} pedido(s)`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
