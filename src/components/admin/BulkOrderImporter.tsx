"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createBulkOrdersAction, type BulkImportResult } from "@/app/painel/actions";
import { bulkRequestId, matchBulkProduct, parseBulkSalesText, type BulkMatchConfidence } from "@/lib/admin/bulk-orders";
import { ORDER_PAYMENT_METHOD_LABELS, type OrderPaymentMethod, type SellerRecord } from "@/lib/admin/types";
import { formatPrice } from "@/lib/utils/format";
import type { OrderProductOption } from "./OrderComposer";

/** Linha da conferencia: o que veio da mensagem + a decisao do operador. */
interface LinhaConferida {
  key: string;
  raw: string;
  quantity: number;
  productId: string;
  unitPriceCents: number;
  confidence: BulkMatchConfidence;
  alternativas: Array<{ productId: string; name: string; stock: number; priceCents: number }>;
}

interface BlocoConferido {
  key: string;
  channelLabel: string;
  customerName: string;
  date: string;
  paid: boolean;
  paymentMethod: OrderPaymentMethod;
  linhas: LinhaConferida[];
  notas: string[];
  valoresLidos: number[];
}

const CANAL_ROTULO: Record<string, string> = {
  retirada: "Retirada",
  entrega: "Entrega",
  shopee: "Shopee",
  mercado_livre: "Mercado Livre",
  magalu: "Magalu",
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

function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function BulkOrderImporter({ products, sellers }: { products: OrderProductOption[]; sellers: SellerRecord[] }) {
  const [texto, setTexto] = useState("");
  const [sellerId, setSellerId] = useState(sellers.find((seller) => seller.active)?.id ?? "");
  const [blocos, setBlocos] = useState<BlocoConferido[] | null>(null);
  const [resultado, setResultado] = useState<BulkImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // Memorizado para o indice do catalogo ser montado uma vez so, e nao a cada
  // uma das dezenas de linhas coladas.
  const catalogo = useMemo(() => products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock, price_cents: p.price_cents })), [products]);

  function interpretar() {
    setResultado(null);
    const hoje = hojeEmSaoPaulo();
    setBlocos(parseBulkSalesText(texto).map((bloco, indice) => {
      const rotulo = bloco.header || CANAL_ROTULO[bloco.channel] || "Lançamento";
      const umValorSo = bloco.priceHints.length === 1 && bloco.items.length === 1;
      return {
        // Sem data na mensagem, cai em hoje: e o que evita dois lancamentos
        // iguais de semanas diferentes colidirem no mesmo request_id.
        key: `${indice}-${bulkRequestId(bloco)}`,
        channelLabel: rotulo,
        customerName: bloco.customerName || rotulo,
        date: bloco.date ?? hoje,
        paid: bloco.paid,
        paymentMethod: bloco.paymentMethod,
        notas: bloco.notes,
        valoresLidos: bloco.priceHints,
        linhas: bloco.items.map((item, posicao) => {
          const match = matchBulkProduct(item.name, catalogo);
          const reconhecido = match.confidence === "alta" ? match.best : null;
          return {
            key: `${indice}-${posicao}`,
            raw: item.raw,
            quantity: item.quantity,
            productId: reconhecido?.productId ?? "",
            // Um item, um valor na mensagem: nao ha ambiguidade sobre a que
            // ele se refere. Com mais de um, o operador escolhe nos atalhos.
            unitPriceCents: umValorSo ? bloco.priceHints[0] : reconhecido?.priceCents ?? 0,
            confidence: match.confidence,
            alternativas: match.alternatives,
          };
        }),
      };
    }));
  }

  function alterarLinha(blocoKey: string, linhaKey: string, mudanca: Partial<LinhaConferida>) {
    setBlocos((atual) => atual?.map((bloco) => bloco.key !== blocoKey ? bloco : {
      ...bloco, linhas: bloco.linhas.map((linha) => linha.key !== linhaKey ? linha : { ...linha, ...mudanca }),
    }) ?? null);
  }

  function alterarBloco(blocoKey: string, mudanca: Partial<BlocoConferido>) {
    setBlocos((atual) => atual?.map((bloco) => bloco.key === blocoKey ? { ...bloco, ...mudanca } : bloco) ?? null);
  }

  function removerLinha(blocoKey: string, linhaKey: string) {
    setBlocos((atual) => atual?.map((bloco) => bloco.key !== blocoKey ? bloco : {
      ...bloco, linhas: bloco.linhas.filter((linha) => linha.key !== linhaKey),
    }) ?? null);
  }

  function escolherProduto(blocoKey: string, linhaKey: string, productId: string) {
    const produto = catalogo.find((item) => item.id === productId);
    alterarLinha(blocoKey, linhaKey, {
      productId,
      unitPriceCents: produto?.price_cents ?? 0,
      confidence: produto ? "alta" : "nenhuma",
    });
  }

  const prontos = (blocos ?? [])
    .map((bloco) => ({ bloco, linhas: bloco.linhas.filter((linha) => linha.productId && linha.unitPriceCents > 0) }))
    .filter((item) => item.linhas.length);

  const pendentes = (blocos ?? []).reduce((soma, bloco) => soma + bloco.linhas.filter((linha) => !linha.productId || !linha.unitPriceCents).length, 0);
  const totalCentavos = prontos.reduce((soma, { linhas }) => soma + linhas.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0), 0);
  const totalUnidades = prontos.reduce((soma, { linhas }) => soma + linhas.reduce((s, l) => s + l.quantity, 0), 0);

  function gravar() {
    if (!prontos.length) return;

    // O requestId sai do conteudo ja resolvido, entao colar a mesma mensagem
    // de novo cai no mesmo id e o banco recusa duplicar.
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
      paymentMethod: bloco.paymentMethod,
      notes: bloco.notas,
      items: linhas.map((linha) => ({ productId: linha.productId, quantity: linha.quantity, unitPriceCents: linha.unitPriceCents })),
    }));

    startTransition(async () => {
      const saida = await createBulkOrdersAction(sellerId, enviados.map((item) => ({
        requestId: item.requestId, channelLabel: item.channelLabel, customerName: item.customerName,
        date: item.date, paid: item.paid, paymentMethod: item.paymentMethod, notes: item.notes, items: item.items,
      })));
      setResultado(saida);
      // Some da tela so o que entrou; o que falhou fica para corrigir.
      const gravados = new Set(saida.created.map((item) => item.requestId));
      const chaves = new Set(enviados.filter((item) => gravados.has(item.requestId)).map((item) => item.blocoKey));
      if (chaves.size) setBlocos((atual) => atual?.filter((bloco) => !chaves.has(bloco.key)) ?? null);
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-ink-200 bg-white p-5">
        <label htmlFor="mensagens" className="block text-xs font-bold text-ink-600">Cole as mensagens do grupo</label>
        <p className="mt-1 text-xs text-ink-500">
          Pode colar a semana inteira. Cada <strong>RETIRADA</strong>, <strong>ENTREGA</strong>, <strong>SHOPEE</strong>, <strong>MERCADO LIVRE</strong> ou <strong>MAGALU</strong> vira um pedido.
          Só vira produto a linha que começa com a quantidade (<code className="rounded bg-ink-50 px-1">02 MIXER…</code>) — nome, endereço, valor e forma de pagamento viram observação do pedido.
        </p>
        <textarea id="mensagens" value={texto} onChange={(event) => setTexto(event.target.value)} rows={10} placeholder={EXEMPLO}
          className={`${campo} mt-3 font-mono text-xs leading-relaxed`} />
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
          {resultado.created.length > 0 && <ul className="mt-2 space-y-0.5 text-xs">{resultado.created.map((item) => <li key={item.requestId}>✓ {item.number} — {item.customerName}</li>)}</ul>}
          {resultado.failed.length > 0 && <ul className="mt-2 space-y-0.5 text-xs">{resultado.failed.map((item) => <li key={item.requestId}>✗ {item.channelLabel}: {item.message}</li>)}</ul>}
          {resultado.created.length > 0 && <Link href="/painel/pedidos" className="mt-2 inline-block font-bold underline">Ver pedidos</Link>}
        </div>
      )}

      {blocos?.length === 0 && (
        <p className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
          Não reconheci nenhum lançamento. Confira se as mensagens têm cabeçalho como <strong>RETIRADA</strong> ou <strong>SHOPEE 04-09</strong>.
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
              <input id={`data-${bloco.key}`} type="date" value={bloco.date} onChange={(e) => alterarBloco(bloco.key, { date: e.target.value })} className={`${campo} mt-1`} />
            </div>
            <div>
              <label htmlFor={`pgto-${bloco.key}`} className="block text-xs font-bold text-ink-600">Pagamento</label>
              <select id={`pgto-${bloco.key}`} value={bloco.paymentMethod} onChange={(e) => alterarBloco(bloco.key, { paymentMethod: e.target.value as OrderPaymentMethod })} className={`${campo} mt-1`}>
                {Object.entries(ORDER_PAYMENT_METHOD_LABELS).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
              </select>
            </div>
            <p className="pb-2 text-xs text-ink-500">{bloco.channelLabel}{bloco.paid ? " · pago" : ""}</p>
          </header>

          {bloco.linhas.length === 0 ? (
            <p className="px-5 py-4 text-sm font-bold text-amber-700">
              Nenhum item com quantidade na frente. Se havia produto aqui, ele precisa começar com o número (ex.: <code className="rounded bg-ink-50 px-1">01 PRODUTO</code>).
            </p>
          ) : (
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
                        <select id={`prod-${linha.key}`} value={linha.productId} onChange={(e) => escolherProduto(bloco.key, linha.key, e.target.value)}
                          className={`${campo} ${linha.productId ? "" : "border-red-300 bg-red-50"}`}>
                          <option value="">— escolha o produto —</option>
                          {linha.alternativas.map((alternativa) => (
                            <option key={alternativa.productId} value={alternativa.productId}>{alternativa.name} · estoque {alternativa.stock}</option>
                          ))}
                          <optgroup label="Catálogo completo">
                            {catalogo.map((item) => <option key={`todos-${item.id}`} value={item.id}>{item.name} · estoque {item.stock}</option>)}
                          </optgroup>
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`qtd-${linha.key}`} className="sr-only">Quantidade</label>
                        <input id={`qtd-${linha.key}`} type="number" min={1} value={linha.quantity}
                          onChange={(e) => alterarLinha(bloco.key, linha.key, { quantity: Math.max(1, Number(e.target.value) || 1) })} className={campo} />
                      </div>
                      <div>
                        <label htmlFor={`valor-${linha.key}`} className="sr-only">Valor unitário em reais</label>
                        <input id={`valor-${linha.key}`} type="number" min={0} step="0.01" placeholder="valor un."
                          value={linha.unitPriceCents ? (linha.unitPriceCents / 100).toFixed(2) : ""}
                          onChange={(e) => alterarLinha(bloco.key, linha.key, { unitPriceCents: Math.max(0, Math.round(Number(e.target.value) * 100) || 0) })}
                          className={`${campo} ${linha.unitPriceCents ? "" : "border-red-300 bg-red-50"}`} />
                      </div>
                    </div>

                    {bloco.valoresLidos.length > 0 && (
                      <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                        Valores na mensagem:
                        {bloco.valoresLidos.map((valor, posicao) => (
                          <button key={`${valor}-${posicao}`} type="button" onClick={() => alterarLinha(bloco.key, linha.key, { unitPriceCents: valor })}
                            className="rounded border border-ink-300 px-1.5 py-0.5 font-bold text-ink-700 hover:border-gold-500">
                            {formatPrice(valor)}
                          </button>
                        ))}
                      </p>
                    )}

                    <p className="mt-1.5 text-xs">
                      {linha.confidence === "alta" && linha.productId && <span className="text-green-700">Produto reconhecido.</span>}
                      {linha.confidence === "duvidosa" && <span className="font-bold text-amber-700">Confira: há mais de um produto parecido.</span>}
                      {linha.confidence === "nenhuma" && !linha.productId && <span className="font-bold text-red-700">Não achei no catálogo. Escolha na lista ou remova a linha.</span>}
                      {!linha.unitPriceCents && linha.productId && <span className="ml-2 font-bold text-red-700">Informe o valor unitário.</span>}
                      {semEstoque && <span className="ml-2 font-bold text-red-700">Estoque atual ({produto?.stock}) menor que a quantidade.</span>}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          {bloco.notas.length > 0 && (
            <div className="border-t border-ink-100 px-5 py-3">
              <p className="text-xs font-bold text-ink-600">Observações (vão junto no pedido)</p>
              <ul className="mt-1 space-y-1 text-xs text-ink-500">
                {bloco.notas.map((nota, posicao) => (
                  <li key={`${bloco.key}-nota-${posicao}`} className="flex flex-wrap items-center gap-2">
                    <span>{nota}</span>
                    <button type="button" onClick={() => alterarBloco(bloco.key, { customerName: nota })} className="font-bold text-ink-400 underline">usar como cliente</button>
                  </li>
                ))}
              </ul>
            </div>
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
              {pendentes > 0 && <span className="block font-bold text-red-700">{pendentes} linha(s) sem produto ou sem valor — elas não serão gravadas.</span>}
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
