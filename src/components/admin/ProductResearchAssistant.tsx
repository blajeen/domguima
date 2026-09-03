"use client";

import { useState } from "react";
import type { ProductResearchResult } from "@/lib/admin/product-research-types";

interface ProductResearchAssistantProps {
  name: string;
  brand: string;
  model: string;
  gtin: string;
  category: string;
  onApply: (result: ProductResearchResult) => void;
}

export function ProductResearchAssistant({ name, brand, model, gtin, category, onApply }: ProductResearchAssistantProps) {
  const [result, setResult] = useState<ProductResearchResult | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function research() {
    if (!model.trim()) {
      setMessage("Informe o modelo para iniciar a pesquisa.");
      return;
    }
    setLoading(true);
    setMessage("");
    setResult(null);
    try {
      const response = await fetch("/api/painel/pesquisar-produto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, brand, model, gtin, category }),
      });
      const data = await response.json() as { result?: ProductResearchResult; message?: string };
      if (!response.ok || !data.result) throw new Error(data.message || "Não foi possível pesquisar este modelo agora.");
      setResult(data.result);
      setMessage("Pesquisa concluída. Confira as fontes e aplique os dados que fizerem sentido.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível pesquisar este modelo agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/70 p-4 sm:col-span-2 lg:col-span-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-violet-700">Pesquisa inteligente</p>
          <p className="mt-1 text-xs leading-relaxed text-violet-900">Pesquisa o modelo na web, prioriza o fabricante e prepara nome, marca, descrição, NCM e especificações para você revisar.</p>
        </div>
        <button type="button" onClick={() => void research()} disabled={loading || !model.trim()} className="shrink-0 rounded-lg bg-violet-700 px-4 py-2.5 text-xs font-black text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "Pesquisando…" : "Pesquisar modelo"}
        </button>
      </div>
      {message && <p role="status" className="mt-3 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs leading-relaxed text-violet-900">{message}</p>}
      {result && <div className="mt-4 rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-wide text-ink-400">Prévia da pesquisa</p><h3 className="mt-1 text-base font-black text-ink-900">{result.name || "Produto identificado"}</h3><p className="mt-1 text-xs text-ink-500">{result.brand || "Marca não confirmada"} · confiança geral: {confidenceLabel(result.confidence)}</p></div>
          <button type="button" onClick={() => onApply(result)} className="rounded-lg bg-ink-900 px-3 py-2 text-xs font-black text-white hover:bg-ink-800">Aplicar dados pesquisados</button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-700">{result.description || "A pesquisa não encontrou uma descrição segura."}</p>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg bg-ink-50 p-3"><strong className="text-ink-900">NCM sugerido:</strong> {result.ncm || "não identificado"}<span className="ml-1 text-ink-500">({confidenceLabel(result.ncmConfidence)})</span><p className="mt-1 text-ink-500">{result.ncmNote || "Confira a classificação com a contabilidade antes de emitir nota."}</p></div>
          <div className="rounded-lg bg-ink-50 p-3"><strong className="text-ink-900">Especificações:</strong> {result.specifications.length ? `${result.specifications.length} encontradas` : "não confirmadas"}<p className="mt-1 text-ink-500">{result.notes || "Revise os dados antes de salvar."}</p></div>
        </div>
        {!!result.sources.length && <div className="mt-3 border-t border-ink-100 pt-3"><p className="text-[10px] font-black uppercase tracking-wide text-ink-400">Fontes consultadas</p><ul className="mt-1 space-y-1">{result.sources.slice(0, 4).map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 underline decoration-blue-200 underline-offset-2 hover:text-blue-900">{source.title} <span className="text-ink-400">({source.domain})</span></a></li>)}</ul></div>}
        <p className="mt-3 text-[10px] leading-relaxed text-ink-400">A pesquisa é uma sugestão assistida. Não aplique NCM, especificações ou promessas comerciais sem conferir a fonte oficial.</p>
      </div>}
    </div>
  );
}

function confidenceLabel(value: ProductResearchResult["confidence"]): string {
  return value === "high" ? "alta" : value === "medium" ? "média" : "baixa";
}
