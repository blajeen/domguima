import "server-only";

import { z } from "zod";
import type { ProductResearchResult, ProductResearchSource } from "./product-research-types";

const resultSchema = z.object({
  name: z.string().trim().max(180),
  brand: z.string().trim().max(100),
  description: z.string().trim().max(1_200),
  ncm: z.string().trim().regex(/^$|^\d{8}$/),
  ncmConfidence: z.enum(["high", "medium", "low"]),
  ncmNote: z.string().trim().max(300),
  specifications: z.array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(180) })).max(20),
  primarySourceUrl: z.string().trim().max(500),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string().trim().max(500),
});

const researchInputSchema = z.object({
  name: z.string().trim().max(180),
  brand: z.string().trim().max(100),
  model: z.string().trim().min(2).max(100),
  gtin: z.string().trim().max(14),
  category: z.string().trim().max(100),
});

export type ProductResearchInput = z.infer<typeof researchInputSchema>;

export class ProductResearchError extends Error {
  readonly code: "not_configured" | "provider" | "invalid_result";

  constructor(code: ProductResearchError["code"], message: string) {
    super(message);
    this.name = "ProductResearchError";
    this.code = code;
  }
}

/**
 * Pesquisa assistida no servidor. A chave nunca chega ao navegador.
 * O modelo precisa consultar a web, mas a decisão final de NCM continua
 * sendo do lojista: o resultado sempre vem com fonte e nível de confiança.
 */
export async function researchProduct(input: ProductResearchInput): Promise<ProductResearchResult> {
  const parsedInput = researchInputSchema.safeParse(input);
  if (!parsedInput.success) throw new ProductResearchError("provider", "Informe um modelo válido para pesquisar.");

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ProductResearchError("not_configured", "O assistente online ainda não foi configurado no painel da Vercel.");
  }

  const model = process.env.OPENAI_PRODUCT_RESEARCH_MODEL?.trim() || "gpt-5.4-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1_800,
        max_tool_calls: 3,
        reasoning: { effort: "none" },
        tools: [{ type: "web_search_preview", search_context_size: "low" }],
        tool_choice: "required",
        input: [
          {
            role: "developer",
            content: [{ type: "input_text", text: [
              "Você é um pesquisador de cadastro de produtos para uma loja brasileira. Sua prioridade é confirmar a identidade exata do produto antes de preencher qualquer dado.",
              "Siga obrigatoriamente este protocolo, nesta ordem: 1) normalize marca, modelo, EAN/GTIN e categoria; 2) pesquise primeiro no domínio oficial do fabricante, procurando a página do produto, o manual, a ficha técnica ou a página de suporte; 3) somente depois complemente com a internet geral, priorizando fontes técnicas confiáveis e varejistas autorizados; 4) compare as fontes e descarte resultados de modelo parecido, outra capacidade, tamanho, voltagem, cor, geração ou revisão.",
              "A fonte oficial do fabricante prevalece sobre todas as outras. Marketplace, anúncio, blog, comparador e varejista nunca são fonte oficial. Quando não localizar o modelo exato em uma fonte oficial, registre isso em notes e use confidence low ou medium, conforme a evidência disponível.",
              "Não invente, não complete por intuição e não transfira características de um modelo semelhante. Letras, números e sufixos do modelo precisam coincidir. Em caso de divergência, prefira o manual ou a página oficial; se o conflito continuar, deixe o dado vazio e explique em notes.",
              "Escreva description em português do Brasil com 2 a 4 frases curtas, claras e comerciais, usando somente características confirmadas. Não mencione preço, estoque, frete, prazo, garantia ou desempenho não comprovado.",
              "Preencha specifications apenas com fatos confirmados, sem duplicatas, usando rótulos curtos e valores objetivos. primarySourceUrl deve apontar para a melhor fonte encontrada e, quando existir, para a página oficial do fabricante.",
              "Para NCM, trate o resultado apenas como sugestão fiscal. Não derive NCM somente da categoria nem de produto semelhante. Informe os 8 dígitos apenas quando houver evidência razoável para o produto exato; caso contrário, deixe ncm vazio, use ncmConfidence low e explique em ncmNote que é necessária conferência contábil/fiscal.",
              "Se o produto exato não puder ser identificado com segurança, preserve somente os dados confirmados, deixe o restante vazio e explique a limitação. Retorne apenas o JSON que respeita estritamente o schema solicitado, sem Markdown ou texto adicional.",
            ].join(" ")}],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify({
              produtoInformado: parsedInput.data.name,
              marcaInformada: parsedInput.data.brand,
              modelo: parsedInput.data.model,
              gtin: parsedInput.data.gtin,
              categoria: parsedInput.data.category,
            }) }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "product_research",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                brand: { type: "string" },
                description: { type: "string" },
                ncm: { type: "string" },
                ncmConfidence: { type: "string", enum: ["high", "medium", "low"] },
                ncmNote: { type: "string" },
                specifications: { type: "array", items: { type: "object", additionalProperties: false, properties: { label: { type: "string" }, value: { type: "string" } }, required: ["label", "value"] } },
                primarySourceUrl: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                notes: { type: "string" },
              },
              required: ["name", "brand", "description", "ncm", "ncmConfidence", "ncmNote", "specifications", "primarySourceUrl", "confidence", "notes"],
            },
          },
        },
        include: ["web_search_call.action.sources"],
      }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new ProductResearchError("provider", "A chave do assistente online foi recusada. Confira a configuração da Vercel.");
      throw new ProductResearchError("provider", "A pesquisa online está indisponível no momento. Tente novamente.");
    }

    const payload = await response.json() as OpenAIResponse;
    const text = payload.output_text || payload.output?.flatMap((item) => item.content ?? []).find((content) => content.type === "output_text")?.text || "";
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ProductResearchError("invalid_result", "A pesquisa retornou um formato que precisa ser revisado. Tente novamente.");
    }
    const result = resultSchema.safeParse(raw);
    if (!result.success) throw new ProductResearchError("invalid_result", "A pesquisa não retornou dados confiáveis para preencher.");
    const requestedPrimary = safeHttpUrl(result.data.primarySourceUrl);
    const sources = extractSources(payload, requestedPrimary);
    const primary = requestedPrimary || sources[0]?.url || "";
    return { ...result.data, primarySourceUrl: primary, sources };
  } catch (error) {
    if (error instanceof ProductResearchError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new ProductResearchError("provider", "A pesquisa demorou mais que o esperado. Tente novamente.");
    throw new ProductResearchError("provider", "Não foi possível pesquisar este modelo agora.");
  } finally {
    clearTimeout(timeout);
  }
}

interface OpenAIResponse {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string; annotations?: unknown[] }>;
    action?: { sources?: unknown[] };
  }>;
}

function extractSources(payload: OpenAIResponse, primaryUrl: string): ProductResearchSource[] {
  const actionSources = payload.output?.flatMap((item) => item.action?.sources ?? []) ?? [];
  const citationSources = payload.output?.flatMap((item) => item.content?.flatMap((content) => content.annotations ?? []) ?? []) ?? [];
  const sourceItems = [...actionSources, ...citationSources];
  return sourceItems.flatMap((source) => {
    if (!isRecord(source) || typeof source.url !== "string") return [];
    try {
      const url = new URL(source.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") return [];
      const normalizedUrl = url.toString();
      const domain = url.hostname.replace(/^www\./, "");
      const title = typeof source.title === "string" && source.title.trim() ? source.title.trim().slice(0, 180) : domain;
      return [{ title, url: normalizedUrl, domain }];
    } catch {
      return [];
    }
  }).filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index)
    .sort((a, b) => Number(b.url === primaryUrl) - Number(a.url === primaryUrl))
    .slice(0, 8);
}

function safeHttpUrl(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
