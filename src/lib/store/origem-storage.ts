import type { OrderAttribution } from "@/lib/admin/types";
// origem-regras e nao origem.ts: este modulo roda em TODA pagina da loja, e
// origem.ts carrega o zod (ver o cabecalho de origem-regras.ts).
import { cleanAttribution, mergeAttribution, ORIGEM_COOKIE, ORIGEM_MAX_AGE } from "@/lib/services/origem-regras";

/**
 * Origem do visitante guardada no proprio navegador.
 *
 * Mesmo desenho do carrinho (cart-storage.ts): chave com namespace e versao,
 * toda leitura e escrita em try/catch. Modo privado, cota cheia ou cookie
 * bloqueado nunca podem quebrar a pagina — no pior caso o pedido entra como
 * "Direto".
 *
 * Duas copias, com papeis diferentes:
 *   - localStorage `domguima:origem:v1`: a fonte da verdade no navegador, lida
 *     pelo checkout para mandar a origem junto com o pedido;
 *   - cookie `domguima_origem` (90 dias, SameSite=Lax): o espelho que o
 *     SERVIDOR enxerga quando o cliente clica no WhatsApp — ali nao ha
 *     JavaScript no meio, so a navegacao para /api/atendimentos/whatsapp.
 *
 * Nada aqui sai para terceiros. O prazo de 90 dias vale para as duas copias:
 * passado o prazo desde a ultima gravacao, a origem e descartada.
 */

const STORAGE_KEY = "domguima:origem:v1";
const PRAZO_MS = ORIGEM_MAX_AGE * 1_000;

/**
 * Cada valor do cookie e cortado bem abaixo do teto do servidor: o cookie
 * inteiro tem de caber folgado nos ~4 KB que o navegador aceita.
 */
const COOKIE_VALOR_MAX = 100;
const COOKIE_MAX = 3_000;

/** Campos que ficam no cookie quando a versao completa passaria do tamanho. */
const ESSENCIAIS: Array<keyof OrderAttribution> = ["utm_source", "utm_medium", "utm_campaign", "referrer", "landing_path", "fbclid", "gclid", "first_seen_at"];

interface Envelope {
  v: 1;
  /** Quando a origem foi gravada pela ultima vez: conta o prazo de 90 dias. */
  savedAt: string;
  origem: OrderAttribution;
}

export interface VisitaAtual {
  pathname: string;
  /** Query string da pagina, sem o "?". */
  search: string;
  /** `document.referrer` como veio. */
  referrer: string;
}

/**
 * Registra a visita: chamada pelo CapturaOrigem a cada pagina da loja.
 *
 * So grava quando a origem muda (ver `mergeAttribution`); fora isso, apenas
 * refaz o cookie se ele sumiu (limpeza de cookies com o armazenamento local
 * intacto), com o prazo que ainda resta.
 */
export function registrarOrigem(visita: VisitaAtual): void {
  try {
    const agora = new Date();
    const salvo = lerEnvelope(agora);
    const toque = toqueDaVisita(visita);
    const nova = mergeAttribution(salvo?.origem ?? null, toque, agora.toISOString());

    if (nova) {
      gravar({ v: 1, savedAt: agora.toISOString(), origem: nova });
      return;
    }
    if (salvo && !cookieExiste()) {
      const restante = Math.floor((Date.parse(salvo.savedAt) + PRAZO_MS - agora.getTime()) / 1_000);
      if (restante > 0) escreverCookie(salvo.origem, restante);
    }
  } catch {
    // Sem armazenamento disponivel o site segue normal; so a origem se perde.
  }
}

/** Origem guardada (ainda dentro do prazo), para o checkout mandar com o pedido. */
export function lerOrigem(): OrderAttribution | null {
  try {
    return lerEnvelope(new Date())?.origem ?? null;
  } catch {
    return null;
  }
}

function toqueDaVisita(visita: VisitaAtual): OrderAttribution {
  const busca = new URLSearchParams(visita.search);
  const valor = (chave: string) => busca.get(chave)?.trim().slice(0, COOKIE_VALOR_MAX) || undefined;
  const referrer = hostExterno(visita.referrer);
  return cleanAttribution({
    utm_source: valor("utm_source"),
    utm_medium: valor("utm_medium"),
    utm_campaign: valor("utm_campaign"),
    utm_content: valor("utm_content"),
    utm_term: valor("utm_term"),
    // O identificador do clique e do Facebook/Google e a loja nao o usa: basta
    // saber que o link era de anuncio.
    fbclid: busca.has("fbclid") ? "1" : undefined,
    gclid: busca.has("gclid") || busca.has("gbraid") || busca.has("wbraid") ? "1" : undefined,
    referrer,
    landing_path: visita.pathname.slice(0, COOKIE_VALOR_MAX),
  });
}

/**
 * So o dominio de quem trouxe o cliente, e so se for de FORA: navegar dentro
 * da loja nao e origem. Caminho e busca do site anterior ficam de fora — podem
 * carregar o que a pessoa pesquisou.
 */
function hostExterno(referrer: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const url = new URL(referrer);
    // "www.loja" e "loja" sao o mesmo site: navegar entre os dois nao e origem.
    const host = (url.hostname || url.href).replace(/^www\./, "");
    if (host === window.location.hostname.replace(/^www\./, "")) return undefined;
    return host.slice(0, COOKIE_VALOR_MAX) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * O que ja esta guardado: o armazenamento local e, sem ele, o cookie.
 *
 * O cookie como segunda fonte existe para navegador que recusa o localStorage
 * (cota zero, modo privado antigo): sem ele, a segunda pagina visitada nao
 * acharia nada guardado e sobrescreveria o cookie da campanha com um contato
 * sem UTM.
 */
function lerEnvelope(agora: Date): Envelope | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return envelopeDoCookie(agora);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrompido: descarta, senao a captura ficaria travada nele para sempre.
    apagar();
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    apagar();
    return null;
  }
  const envelope = parsed as Partial<Envelope>;
  const gravadoEm = typeof envelope.savedAt === "string" ? Date.parse(envelope.savedAt) : Number.NaN;
  if (!Number.isFinite(gravadoEm) || agora.getTime() - gravadoEm > PRAZO_MS) {
    // Vencido (ou sem data): some das duas copias, como a politica promete.
    apagar();
    return null;
  }
  return { v: 1, savedAt: new Date(gravadoEm).toISOString(), origem: cleanAttribution(envelope.origem) };
}

/** Origem lida do cookie espelho. O prazo e o do proprio cookie, que o navegador ja controla. */
function envelopeDoCookie(agora: Date): Envelope | null {
  const parte = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${ORIGEM_COOKIE}=`));
  const valor = parte?.slice(ORIGEM_COOKIE.length + 1);
  if (!valor) return null;
  try {
    const origem = cleanAttribution(JSON.parse(decodeURIComponent(valor)));
    return Object.keys(origem).length ? { v: 1, savedAt: agora.toISOString(), origem } : null;
  } catch {
    return null;
  }
}

function gravar(envelope: Envelope): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Cota cheia ou modo privado: o cookie abaixo ainda leva a origem ao servidor.
  }
  escreverCookie(envelope.origem, ORIGEM_MAX_AGE);
}

function apagar(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada a fazer: sem acesso, tambem nao ha o que apagar.
  }
  try {
    document.cookie = `${ORIGEM_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    // Cookie bloqueado.
  }
}

function cookieExiste(): boolean {
  return document.cookie.split(";").some((parte) => parte.trim().startsWith(`${ORIGEM_COOKIE}=`));
}

function escreverCookie(origem: OrderAttribution, maxAge: number): void {
  try {
    let valor = encodeURIComponent(JSON.stringify(recortar(origem, Object.keys(origem) as Array<keyof OrderAttribution>)));
    if (valor.length > COOKIE_MAX) valor = encodeURIComponent(JSON.stringify(recortar(origem, ESSENCIAIS)));
    if (valor.length > COOKIE_MAX) return;
    // Secure so em HTTPS: em http://localhost o navegador recusaria o cookie.
    const seguro = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ORIGEM_COOKIE}=${valor}; Max-Age=${maxAge}; Path=/; SameSite=Lax${seguro}`;
  } catch {
    // Cookie bloqueado: o checkout ainda manda a origem pelo corpo do pedido.
  }
}

function recortar(origem: OrderAttribution, chaves: Array<keyof OrderAttribution>): OrderAttribution {
  const saida: OrderAttribution = {};
  for (const chave of chaves) {
    const valor = origem[chave];
    if (valor) saida[chave] = valor.slice(0, COOKIE_VALOR_MAX);
  }
  return saida;
}
