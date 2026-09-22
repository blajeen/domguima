"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { ProductResearchResult } from "@/lib/admin/product-research-types";
import { isValidGTIN, onlyDigits } from "@/lib/utils/validators";
import { fieldClass } from "./FormControls";

/** Mesmo visual dos campos do painel, sem a margem de cima: fica lado a lado com o botao. */
const lookupFieldClass = fieldClass.replace("mt-1.5 ", "");

/** O que foi pesquisado: o formulario grava o GTIN/modelo digitado como veio. */
export interface ResearchLookup {
  kind: "gtin" | "model";
  value: string;
}

/** Rotulos dos campos que o preenchimento mudou e dos que manteve. */
export interface ResearchFillReport {
  filled: string[];
  kept: string[];
}

interface ProductResearchAssistantProps {
  name: string;
  brand: string;
  model: string;
  gtin: string;
  category: string;
  /** Leitor de codigo de barras pronto para usar ao abrir o cadastro. */
  autoFocus?: boolean;
  /**
   * `replace` nulo preenche so o que esta vazio; com a lista de rotulos,
   * substitui exatamente esses campos ("Substituir pelos encontrados").
   */
  onApply: (result: ProductResearchResult, lookup: ResearchLookup, replace: string[] | null) => ResearchFillReport;
  onUndo: () => void;
}

interface Outcome {
  result: ProductResearchResult;
  lookup: ResearchLookup;
  report: ResearchFillReport;
}

/** Texto que parece codigo de barras: so numeros, com espacos ou pontos soltos. */
function looksLikeGtin(value: string): boolean {
  return /^[\d\s.-]{8,20}$/.test(value.trim()) && onlyDigits(value).length >= 8;
}

/**
 * Busca pelo codigo de barras ou pelo modelo e preenche os campos VAZIOS do
 * cadastro. O que o lojista ja digitou nao e trocado sem ele pedir, e o
 * preenchimento inteiro pode ser desfeito.
 */
export function ProductResearchAssistant({ name, brand, model, gtin, category, autoFocus, onApply, onUndo }: ProductResearchAssistantProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [modelFallback, setModelFallback] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // A resposta pode levar ate 1 minuto e o lojista continua editando o
  // formulario: aplicar com o onApply da renderizacao do clique usaria os
  // valores antigos dos campos e sobrescreveria o que ele digitou na espera.
  const onApplyRef = useRef(onApply);
  useEffect(() => { onApplyRef.current = onApply; });

  function resolveLookup(): ResearchLookup | string {
    const typed = query.trim();
    if (typed) {
      if (looksLikeGtin(typed)) {
        const digits = onlyDigits(typed);
        if (isValidGTIN(digits)) return { kind: "gtin", value: digits };
        setModelFallback(typed.slice(0, 100));
        return "Esse código de barras não confere. Confira os números — o último dígito não bate com os anteriores.";
      }
      return typed.length < 2 ? "Informe um modelo com pelo menos 2 caracteres." : { kind: "model", value: typed.slice(0, 100) };
    }
    // Caixa vazia: pesquisa pelo que ja esta no formulario.
    if (isValidGTIN(gtin)) return { kind: "gtin", value: onlyDigits(gtin) };
    if (model.trim().length >= 2) return { kind: "model", value: model.trim().slice(0, 100) };
    return "Escaneie ou digite o código de barras, ou informe o modelo.";
  }

  async function search(forced?: ResearchLookup) {
    if (loading) return;
    setModelFallback("");
    const lookup = forced ?? resolveLookup();
    if (typeof lookup === "string") {
      setMessage(lookup);
      return;
    }
    // O nome, a marca e o outro codigo do formulario so ajudam quando se
    // pesquisa o MESMO produto de novo. Escaneou outro codigo? Mandar o modelo
    // do produto anterior faria a pesquisa voltar com o produto errado.
    const sameProduct = lookup.kind === "gtin" ? lookup.value === onlyDigits(gtin) : lookup.value === model.trim();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/painel/pesquisar-produto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sameProduct ? name : "",
          brand: sameProduct ? brand : "",
          category,
          model: lookup.kind === "model" ? lookup.value : sameProduct ? model.trim().slice(0, 100) : "",
          gtin: lookup.kind === "gtin" ? lookup.value : sameProduct && isValidGTIN(gtin) ? onlyDigits(gtin) : "",
        }),
      });
      const data = await response.json().catch(() => ({})) as { result?: ProductResearchResult; message?: string };
      if (!response.ok || !data.result) throw new Error(data.message || "Não foi possível buscar este produto agora.");
      const report = onApplyRef.current(data.result, lookup, null);
      setOutcome({ result: data.result, lookup, report });
      setQuery("");
    } catch (error) {
      // O resultado anterior (e o seu "Desfazer") continua na tela.
      setMessage(error instanceof Error ? error.message : "Não foi possível buscar este produto agora.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // O leitor de codigo de barras termina com Enter; sem isto o Enter
    // enviaria o formulario do produto inteiro.
    if (event.key !== "Enter") return;
    event.preventDefault();
    void search();
  }

  function replaceKept() {
    if (!outcome) return;
    const report = onApplyRef.current(outcome.result, outcome.lookup, outcome.report.kept);
    setOutcome({ ...outcome, report: { filled: [...new Set([...outcome.report.filled, ...report.filled])], kept: [] } });
  }

  function undo() {
    onUndo();
    setOutcome(null);
    setMessage("Preenchimento desfeito. Os campos voltaram ao que estava antes da busca.");
  }

  const result = outcome?.result;
  return (
    <div className="mt-4">
      <label htmlFor={inputId} className="block text-xs font-bold text-ink-700">Código de barras ou modelo</label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <input
          id={inputId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escaneie ou digite o EAN/GTIN — ou o modelo, ex.: 50UA8550PSA"
          autoComplete="off"
          autoFocus={autoFocus}
          maxLength={100}
          // readOnly, e nao disabled: desabilitar tira o foco da caixa, e a
          // proxima leitura do leitor de codigo de barras cairia no vazio.
          readOnly={loading}
          aria-busy={loading}
          className={`${lookupFieldClass} sm:flex-1 ${loading ? "bg-ink-50 text-ink-500" : ""}`}
        />
        <button type="button" onClick={() => void search()} disabled={loading} className="shrink-0 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-black text-white transition hover:bg-blue-600 disabled:cursor-wait disabled:opacity-60">
          {loading ? "Buscando…" : "Buscar e preencher"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-ink-500">
        {loading ? "Consultando o cadastro do código de barras e a internet — pode levar até 1 minuto." : "Preenche nome, marca, modelo, NCM, descrição, especificações e peso nos campos que estiverem vazios."}
      </p>

      {message && <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold-200 bg-gold-50 px-3 py-2 text-xs leading-relaxed text-gold-900">
        <span>{message}</span>
        {modelFallback && <button type="button" onClick={() => void search({ kind: "model", value: modelFallback })} className="rounded-md bg-white px-2.5 py-1 font-black text-gold-900 ring-1 ring-gold-300 hover:bg-gold-100">Pesquisar como modelo</button>}
      </div>}

      {outcome && result && <div role="status" className="mt-4 rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wide text-ink-400">Produto encontrado</p>
            <h3 className="mt-1 text-base font-black text-ink-900">{result.name || "Produto não identificado com segurança"}</h3>
            <p className="mt-1 text-xs text-ink-500">{[result.brand, result.model].filter(Boolean).join(" · ") || "Marca e modelo não confirmados"} · confiança {confidenceLabel(result.confidence)}</p>
            <p className="mt-1 flex flex-wrap gap-1">{result.providers.map((provider) => <span key={provider} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800">{provider}</span>)}</p>
          </div>
          <button type="button" onClick={undo} className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-black text-ink-700 hover:border-ink-400">Desfazer preenchimento</button>
        </div>

        {outcome.report.filled.length
          ? <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-900"><strong>Preenchido:</strong> {outcome.report.filled.join(", ")}.</p>
          : <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-700">Nenhum campo vazio pôde ser preenchido com o que foi encontrado.</p>}
        {!!outcome.report.kept.length && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-900">
          <span><strong>Mantido o que você já tinha digitado:</strong> {outcome.report.kept.join(", ")}.</span>
          <button type="button" onClick={replaceKept} className="rounded-md bg-white px-2.5 py-1 font-black text-gold-900 ring-1 ring-gold-300 hover:bg-gold-100">Substituir pelos encontrados</button>
        </div>}

        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg bg-ink-50 p-3"><strong className="text-ink-900">NCM:</strong> {result.ncm || "não identificado"}<span className="ml-1 text-ink-500">(confiança {confidenceLabel(result.ncmConfidence)})</span><p className="mt-1 text-ink-500">{result.ncmNote || "Confira a classificação com a contabilidade antes de emitir nota."}</p></div>
          <div className="rounded-lg bg-ink-50 p-3"><strong className="text-ink-900">Especificações:</strong> {result.specifications.length ? `${result.specifications.length} encontradas` : "não confirmadas"}{result.notes && <p className="mt-1 text-ink-500">{result.notes}</p>}</div>
        </div>

        {!!result.sources.length && <div className="mt-3 border-t border-ink-100 pt-3"><p className="text-[10px] font-black uppercase tracking-wide text-ink-400">Fontes consultadas</p><ul className="mt-1 space-y-1">{result.sources.slice(0, 4).map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 underline decoration-blue-200 underline-offset-2 hover:text-blue-900">{source.title} <span className="text-ink-400">({source.domain})</span></a></li>)}</ul></div>}
        <p className="mt-3 text-[10px] leading-relaxed text-ink-400">Confira os dados antes de salvar — principalmente NCM, voltagem e especificações. Nada é publicado até você clicar em Salvar produto.</p>
      </div>}
    </div>
  );
}

function confidenceLabel(value: ProductResearchResult["confidence"]): string {
  return value === "high" ? "alta" : value === "medium" ? "média" : "baixa";
}
