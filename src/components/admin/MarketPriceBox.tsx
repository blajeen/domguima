"use client";

import { useState } from "react";
import { marketPriceAction } from "@/app/painel/actions";
import type { MarketOffer, MarketPriceResult } from "@/lib/admin/market-price";
import { formatPrice } from "@/lib/utils/format";

/**
 * Comparativo de precos: o menor preco do mesmo modelo, conferido na pagina
 * da loja, mostrado a parte. Nunca troca o preco do cadastro.
 */
export function MarketPriceBox({ name, brand, model, gtin, color, voltage, googleLinks }: { name: string; brand: string; model: string; gtin: string; color: string; voltage: string; googleLinks: React.ReactNode }) {
  const [resultado, setResultado] = useState<MarketPriceResult | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const termo = gtin || [brand, model].filter(Boolean).join(" ").trim() || name.trim();

  async function buscar() {
    setBuscando(true); setMensagem("");
    try {
      const resposta = await marketPriceAction({ name, brand, model, gtin, color, voltage });
      if (!resposta.ok || !resposta.result) { setMensagem(resposta.message ?? "Não foi possível comparar agora."); return; }
      setResultado(resposta.result);
      if (!resposta.result.offers.length) setMensagem("Nenhuma oferta confiável do mesmo modelo foi encontrada.");
    } catch { setMensagem("Não foi possível comparar agora."); }
    finally { setBuscando(false); }
  }

  const consultado = resultado ? new Date(resultado.checkedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
  return <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:col-span-2 lg:col-span-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-black text-blue-950">Comparativo de preços</p><p className="mt-1 text-xs text-blue-700">Pesquisa atual: {termo || "informe nome, modelo ou EAN"}</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={buscar} disabled={buscando || !termo} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-black text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50">{buscando ? "Comparando… (até 1 min)" : "Buscar menor preço"}</button>
        {googleLinks}
      </div>
    </div>
    {mensagem && <p role="status" className="mt-2 text-xs text-blue-900">{mensagem}</p>}
    {resultado && resultado.offers.length > 0 && <div className="mt-3 space-y-2">
      {resultado.lowest
        ? <Oferta oferta={resultado.lowest} destaque consultado={consultado} />
        : <p className="rounded-lg bg-white px-3 py-2 text-xs text-ink-700 ring-1 ring-blue-100">Nenhuma oferta pôde ser conferida na página da loja (preço e modelo). As encontradas estão abaixo, sem conferência.</p>}
      <details className="rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-blue-100"><summary className="cursor-pointer font-bold text-blue-900">Todas as ofertas encontradas ({resultado.offers.length})</summary>
        <ul className="mt-2 space-y-2">{resultado.offers.map((oferta) => <li key={oferta.url}><Oferta oferta={oferta} consultado={consultado} /></li>)}</ul>
      </details>
    </div>}
    <p className="mt-2 text-[10px] leading-relaxed text-blue-600">Só referência: o preço do cadastro continua o que você digitou. Cada oferta é aberta na loja para conferir preço e modelo; frete depende do CEP.</p>
  </div>;
}

function Oferta({ oferta, destaque = false, consultado }: { oferta: MarketOffer; destaque?: boolean; consultado: string }) {
  const conferida = oferta.priceChecked && oferta.productChecked;
  return <div className={destaque ? "rounded-lg bg-white p-3 ring-2 ring-blue-300" : ""}>
    {destaque && <p className="text-[10px] font-black uppercase tracking-wide text-blue-700">Menor preço conferido</p>}
    <p className="mt-0.5"><strong className="text-sm text-ink-900">{formatPrice(oferta.priceCents)}</strong> <span className="text-ink-700">· {oferta.store}{oferta.seller && oferta.seller !== oferta.store ? ` (vendido por ${oferta.seller})` : ""}</span>
      <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${conferida ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>{conferida ? "conferido na loja" : !oferta.productChecked ? "modelo não conferido" : "preço não conferido"}</span></p>
    <p className="mt-0.5 text-ink-600">{[oferta.payment && `Pagamento: ${oferta.payment}`, oferta.coupon && `Cupom: ${oferta.coupon}`, `Frete: ${oferta.shipping}`].filter(Boolean).join(" · ")}</p>
    <p className="mt-0.5 text-ink-500"><a href={oferta.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">abrir oferta</a> · consultado em {consultado}</p>
  </div>;
}
