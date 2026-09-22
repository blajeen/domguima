import "server-only";

import { z } from "zod";
import { isValidGTIN, onlyDigits } from "@/lib/utils/validators";
import { lookupCosmos, type CosmosLookup, type CosmosProduct } from "./cosmos";
import type { ProductResearchResult, ProductResearchSource } from "./product-research-types";

/** Prazo total da pesquisa, abaixo do maxDuration de 60s da rota. */
const RESEARCH_DEADLINE_MS = 55_000;
const MIN_WEB_TIMEOUT_MS = 15_000;

const webResultSchema = z.object({
  name: z.string().trim().max(180),
  brand: z.string().trim().max(100),
  model: z.string().trim().max(100),
  // Texto livre de proposito: o modelo as vezes devolve "EAN-13: 789...".
  // O codigo e extraido depois; um GTIN mal escrito nunca derruba o resto.
  gtin: z.string().trim().max(200),
  description: z.string().trim().max(1_200),
  ncm: z.string().trim().regex(/^$|^\d{8}$/),
  ncmConfidence: z.enum(["high", "medium", "low"]),
  ncmNote: z.string().trim().max(300),
  specifications: z.array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(180) })).max(20),
  primarySourceUrl: z.string().trim().max(500),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string().trim().max(500),
});

type WebResult = z.infer<typeof webResultSchema> & { sources: ProductResearchSource[] };

/**
 * Basta o codigo de barras OU o modelo: quem cadastra com o leitor na mao so
 * tem o GTIN, e quem cadastra pela caixa as vezes so tem o modelo.
 */
const researchInputSchema = z.object({
  name: z.string().trim().max(180),
  brand: z.string().trim().max(100),
  model: z.string().trim().max(100),
  gtin: z.string().trim().max(14),
  category: z.string().trim().max(100),
}).refine((value) => value.model.length >= 2 || isValidGTIN(value.gtin), { message: "Informe o código de barras ou o modelo." });

export type ProductResearchInput = z.infer<typeof researchInputSchema>;

export class ProductResearchError extends Error {
  readonly code: "not_configured" | "not_found" | "provider" | "invalid_result";

  constructor(code: ProductResearchError["code"], message: string) {
    super(message);
    this.name = "ProductResearchError";
    this.code = code;
  }
}

const COSMOS_LABEL = "Cadastro do código de barras (Cosmos)";
const WEB_LABEL = "Pesquisa na web";

/**
 * Pesquisa assistida no servidor. As chaves nunca chegam ao navegador.
 *
 * Duas fontes, cada uma opcional:
 * 1. Cosmos, pelo GTIN: rapido e traz nome, marca, NCM e peso do cadastro
 *    oficial do codigo de barras.
 * 2. Pesquisa na web (OpenAI), pelo GTIN ou modelo: traz descricao,
 *    especificacoes e o modelo exato, priorizando o fabricante.
 * Se so uma estiver configurada (ou so uma responder), o lojista recebe o que
 * ela achou. A decisao final de NCM continua sendo dele: o resultado sempre
 * diz de onde veio e com que confianca.
 */
export async function researchProduct(input: ProductResearchInput): Promise<ProductResearchResult> {
  const parsedInput = researchInputSchema.safeParse(input);
  if (!parsedInput.success) throw new ProductResearchError("provider", "Informe o código de barras ou o modelo para pesquisar.");
  const startedAt = Date.now();
  const data = parsedInput.data;
  const gtin = onlyDigits(data.gtin);
  const hasGtin = isValidGTIN(gtin);

  const cosmos: CosmosLookup | null = hasGtin ? await lookupCosmos(gtin) : null;
  const cosmosProduct = cosmos?.status === "found" ? cosmos.product : null;
  const cosmosNote = cosmos ? cosmosStatusNote(cosmos) : "";

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    if (cosmosProduct) return fromCosmos(cosmosProduct, gtin, "A pesquisa na web não está ativada: descrição e especificações não foram buscadas.");
    if (cosmos?.status === "not_found") throw new ProductResearchError("not_found", "Este código de barras não está no cadastro nacional (Cosmos). Tente pelo modelo.");
    if (cosmos?.status === "limit") throw new ProductResearchError("provider", "O limite diário de consultas de código de barras acabou. Tente amanhã ou pesquise pelo modelo.");
    if (cosmos?.status === "unauthorized") throw new ProductResearchError("provider", "O token do Cosmos foi recusado. Confira a configuração na Vercel.");
    if (cosmos?.status === "error") throw new ProductResearchError("provider", "O cadastro de códigos de barras não respondeu agora. Tente novamente.");
    throw new ProductResearchError("not_configured", "A busca automática ainda não foi ativada neste painel. Peça ao responsável técnico para configurar o Cosmos (código de barras) ou a pesquisa na web na Vercel.");
  }

  let web: WebResult;
  try {
    // O Cosmos ja gastou parte do prazo: a web fica com o que sobra.
    const webTimeout = Math.max(MIN_WEB_TIMEOUT_MS, RESEARCH_DEADLINE_MS - (Date.now() - startedAt));
    web = await researchOnWeb(apiKey, { ...data, gtin: hasGtin ? gtin : "" }, cosmosProduct, webTimeout);
  } catch (error) {
    // O cadastro do codigo de barras ja identificou o produto: devolver o que
    // ele trouxe vale mais do que um erro por causa da pesquisa na web.
    if (cosmosProduct) return fromCosmos(cosmosProduct, gtin, "A pesquisa na web não respondeu agora; tente de novo para buscar descrição e especificações.");
    throw error;
  }

  const result = cosmosProduct ? mergeWithCosmos(web, cosmosProduct, gtin) : fromWeb(web, hasGtin ? gtin : "");
  if (cosmosNote) result.notes = joinNotes(result.notes, cosmosNote);
  return result;
}

function fromWeb(web: WebResult, gtin: string): ProductResearchResult {
  return {
    ...web,
    gtin: gtin || web.gtin,
    weightGrams: null,
    providers: [WEB_LABEL],
  };
}

function fromCosmos(product: CosmosProduct, gtin: string, note: string): ProductResearchResult {
  return {
    name: tidyCatalogText(product.description),
    brand: tidyBrand(product.brand),
    model: "",
    gtin,
    description: "",
    ncm: product.ncm,
    ncmConfidence: product.ncm ? "medium" : "low",
    ncmNote: cosmosNcmNote(product),
    specifications: [],
    weightGrams: product.weightGrams,
    primarySourceUrl: "",
    sources: [],
    confidence: "medium",
    notes: note,
    providers: [COSMOS_LABEL],
  };
}

/**
 * A web escreve nome e marca melhor (o Cosmos vem em CAIXA ALTA abreviada) e e
 * a unica que traz descricao e especificacoes; o Cosmos manda no NCM e no peso,
 * que vem do cadastro do proprio codigo de barras e nao de um palpite.
 */
function mergeWithCosmos(web: WebResult, product: CosmosProduct, gtin: string): ProductResearchResult {
  const ncmFromCosmos = Boolean(product.ncm);
  const divergentNcm = ncmFromCosmos && web.ncm && web.ncm !== product.ncm
    ? ` A pesquisa na web sugeriu ${web.ncm}; mantivemos o do cadastro.`
    : "";
  return {
    ...web,
    name: web.name || tidyCatalogText(product.description),
    brand: web.brand || tidyBrand(product.brand),
    gtin,
    ncm: ncmFromCosmos ? product.ncm : web.ncm,
    ncmConfidence: ncmFromCosmos ? "medium" : web.ncmConfidence,
    ncmNote: ncmFromCosmos ? `${cosmosNcmNote(product)}${divergentNcm}` : web.ncmNote,
    weightGrams: product.weightGrams,
    // O cadastro do GTIN confirmou a identidade: mesmo que a web nao tenha
    // achado a pagina do fabricante, nome/marca/NCM nao sao chute.
    confidence: web.confidence === "high" ? "high" : "medium",
    providers: [COSMOS_LABEL, WEB_LABEL],
  };
}

function cosmosNcmNote(product: CosmosProduct): string {
  if (!product.ncm) return "O cadastro do código de barras não informa NCM. Confira com a contabilidade.";
  const detail = product.ncmDescription ? ` (${product.ncmDescription.slice(0, 80)})` : "";
  return `NCM informado no cadastro do código de barras${detail}. Confira com a contabilidade antes de emitir nota.`;
}

function cosmosStatusNote(lookup: CosmosLookup): string {
  switch (lookup.status) {
    case "not_found": return "O código de barras não está no cadastro nacional (Cosmos); os dados vieram só da web.";
    case "limit": return "O limite diário de consultas ao Cosmos acabou; os dados vieram só da web.";
    case "unauthorized": return "O token do Cosmos foi recusado; confira a configuração na Vercel.";
    case "error": return "O Cosmos não respondeu agora; os dados vieram só da web.";
    default: return "";
  }
}

function joinNotes(first: string, second: string): string {
  return [first, second].filter(Boolean).join(" ").slice(0, 700);
}

const LOWERCASE_WORDS = new Set(["de", "da", "do", "das", "dos", "com", "para", "e", "em", "sem", "a", "o", "por"]);
/** Siglas e marcas que se escrevem em maiusculas mesmo com 4+ letras. */
const KEEP_UPPERCASE = new Set(["HDMI", "QLED", "OLED", "NEOQLED", "WIFI", "WI-FI", "NVME", "ASUS", "AMOLED", "DDR4", "DDR5", "SATA", "LCD", "LED", "USB", "SSD", "HDR", "UHD", "FHD", "RGB", "JBL", "AOC", "TCL", "LG", "TV"]);
/** Palavras comuns de 3 letras (as de 3 letras sao siglas por padrao). */
const SHORT_WORDS = new Set(["SOM", "COR", "LUZ", "KIT", "GÁS", "GAS", "PIA", "MEL", "SAL", "PÁ"]);

/**
 * "SMART TV SAMSUNG 50 CRYSTAL UHD 4K UN50DU7700" vira
 * "Smart TV Samsung 50 Crystal UHD 4K UN50DU7700": palavras de letras com 4+
 * caracteres (e algumas comuns de 3) mudam; siglas (TV, UHD, HDMI) e codigos
 * com numero ficam como vieram.
 */
function tidyCatalogText(value: string): string {
  const text = value.trim().replace(/\s+/g, " ");
  if (text !== text.toUpperCase()) return text;
  return text.split(" ").map((word, index) => {
    const lower = word.toLocaleLowerCase("pt-BR");
    if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower;
    if (KEEP_UPPERCASE.has(word)) return word;
    if (/^\p{L}{4,}$/u.test(word) || SHORT_WORDS.has(word)) return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    return word;
  }).join(" ");
}

function tidyBrand(value: string): string {
  const brand = value.trim();
  return brand.length > 3 && brand === brand.toUpperCase() ? tidyCatalogText(brand) : brand;
}

async function researchOnWeb(apiKey: string, input: ProductResearchInput, hint: CosmosProduct | null, timeoutMs: number): Promise<WebResult> {
  const model = process.env.OPENAI_PRODUCT_RESEARCH_MODEL?.trim() || "gpt-5.4-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1_800,
        // Uma busca a mais que antes: com so o GTIN, a primeira serve para
        // descobrir marca e modelo.
        max_tool_calls: 5,
        reasoning: { effort: "none" },
        tools: [{
          type: "web_search_preview",
          search_context_size: "low",
          user_location: { type: "approximate", country: "BR", timezone: "America/Sao_Paulo" },
        }],
        tool_choice: "required",
        input: [
          {
            role: "developer",
            content: [{ type: "input_text", text: [
              "Você é um pesquisador de cadastro de produtos para uma loja brasileira. Sua prioridade é confirmar a identidade exata do produto antes de preencher qualquer dado.",
              "Quando o gtin vier preenchido e o modelo vier vazio, comece pesquisando o número exato do gtin entre aspas: lojas brasileiras exibem o EAN ou código de barras na página do produto. Use esses resultados apenas para descobrir marca e modelo exatos; um resultado só vale se mostrar o mesmo número de gtin. Depois siga o protocolo abaixo com o modelo descoberto.",
              "Quando cadastroCodigoDeBarras vier preenchido, ele é o cadastro oficial do gtin: trate descrição e marca dele como a identidade confirmada do produto e use a web para achar o modelo exato, a descrição e as especificações desse mesmo produto.",
              "Siga obrigatoriamente este protocolo, nesta ordem: 1) normalize marca, modelo, EAN/GTIN e categoria; 2) quando a marca estiver informada, pesquise primeiro o modelo exato no domínio oficial do fabricante; 3) quando a marca estiver vazia, faça uma única busca de descoberta usando o modelo exato entre aspas junto de produto e da categoria para identificar o fabricante provável; 4) depois pesquise a página oficial do produto, manual, ficha técnica ou suporte no domínio desse fabricante; 5) por último complemente e valide na internet geral, priorizando fontes técnicas confiáveis e varejistas autorizados.",
              "Pesquise o código do modelo exatamente como foi informado, incluindo letras, números e sufixos. Se a primeira consulta não localizar o item, tente uma variação sem espaços, hífens ou pontuação antes de concluir que não há resultado. Um código curto como LES11 ainda deve ser pesquisado literalmente junto da categoria e das palavras produto e fabricante.",
              "A fonte oficial do fabricante prevalece sobre todas as outras. Marketplace, anúncio, blog, comparador e varejista nunca são fonte oficial. Quando não localizar o modelo exato em uma fonte oficial, registre isso em notes e use confidence low ou medium, conforme a evidência disponível.",
              "Não invente, não complete por intuição e não transfira características de um modelo semelhante. Letras, números e sufixos do modelo precisam coincidir. Em caso de divergência, prefira o manual ou a página oficial; se o conflito continuar, deixe o dado vazio e explique em notes.",
              "Preencha model com o código de modelo exato confirmado e gtin com o código de barras confirmado (só dígitos); deixe vazios quando não tiver certeza.",
              "Escreva name como o título de vitrine em português do Brasil: tipo de produto, marca, linha e o dado que diferencia (tamanho, capacidade, voltagem), sem caixa alta e sem repetir palavras.",
              "Escreva description em português do Brasil com 2 a 4 frases curtas, claras e comerciais, usando somente características confirmadas. Não mencione preço, estoque, frete, prazo, garantia ou desempenho não comprovado.",
              "Preencha specifications apenas com fatos confirmados, sem duplicatas, usando rótulos curtos e valores objetivos. primarySourceUrl deve apontar para a melhor fonte encontrada e, quando existir, para a página oficial do fabricante.",
              "Para NCM, trate o resultado apenas como sugestão fiscal. Não derive NCM somente da categoria nem de produto semelhante. Informe os 8 dígitos apenas quando houver evidência razoável para o produto exato; caso contrário, deixe ncm vazio, use ncmConfidence low e explique em ncmNote que é necessária conferência contábil/fiscal.",
              "Se o produto exato não puder ser identificado com segurança, preserve somente os dados confirmados, deixe o restante vazio e explique a limitação. Retorne apenas o JSON que respeita estritamente o schema solicitado, sem Markdown ou texto adicional.",
            ].join(" ")}],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify({
              produtoInformado: input.name,
              marcaInformada: input.brand,
              modelo: input.model,
              gtin: input.gtin,
              categoria: input.category,
              cadastroCodigoDeBarras: hint ? { descricao: hint.description, marca: hint.brand, ncm: hint.ncm } : null,
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
                model: { type: "string" },
                gtin: { type: "string" },
                description: { type: "string" },
                ncm: { type: "string" },
                ncmConfidence: { type: "string", enum: ["high", "medium", "low"] },
                ncmNote: { type: "string" },
                specifications: { type: "array", items: { type: "object", additionalProperties: false, properties: { label: { type: "string" }, value: { type: "string" } }, required: ["label", "value"] } },
                primarySourceUrl: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                notes: { type: "string" },
              },
              required: ["name", "brand", "model", "gtin", "description", "ncm", "ncmConfidence", "ncmNote", "specifications", "primarySourceUrl", "confidence", "notes"],
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
    const result = webResultSchema.safeParse(raw);
    if (!result.success) throw new ProductResearchError("invalid_result", "A pesquisa não retornou dados confiáveis para preencher.");
    const requestedPrimary = safeHttpUrl(result.data.primarySourceUrl);
    const sources = extractSources(payload, requestedPrimary);
    const primary = requestedPrimary || sources[0]?.url || "";
    const gtin = pickGtin(result.data.gtin);
    return { ...result.data, gtin, primarySourceUrl: primary, sources };
  } catch (error) {
    if (error instanceof ProductResearchError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new ProductResearchError("provider", "A pesquisa demorou mais que o esperado. Tente novamente.");
    throw new ProductResearchError("provider", "Não foi possível pesquisar este produto agora.");
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

/**
 * Primeiro codigo valido dentro do texto que a pesquisa devolveu: aceita
 * "789 4900 011517", "EAN-13: 7894900011517" ou dois codigos separados por
 * barra. O que nao passa no digito verificador e erro de leitura da pagina.
 */
function pickGtin(value: string): string {
  const agrupados = (value.match(/\d[\d\s.-]*\d/g) ?? []).map(onlyDigits);
  const soltos = value.match(/\d+/g) ?? [];
  return [...agrupados, ...soltos].find((candidate) => isValidGTIN(candidate)) ?? "";
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
