import type { OrderAttribution, TrafficSource } from "@/lib/admin/types";
import { normalize } from "@/lib/utils/format";

/**
 * Regras da origem que tambem rodam no NAVEGADOR: a captura em cada pagina da
 * loja (origem-storage.ts) e a previa do gerador de links do painel. Ficam
 * separadas de origem.ts so por peso: la mora o schema zod, e importar o zod
 * aqui o colocaria no pacote de todas as paginas da vitrine. O servidor usa
 * tudo por origem.ts, que reexporta este modulo e confere o resultado com o
 * `attributionSchema`.
 */

/** Cookie espelho da origem: e o que o servidor enxerga nas rotas de WhatsApp e de pedidos. */
export const ORIGEM_COOKIE = "domguima_origem";

/**
 * Visitante anonimo, gravado (httpOnly) pela rota do WhatsApp e pela de
 * pedidos. Serve para o dedupe de 90s e para juntar os contatos do mesmo
 * navegador — nunca carrega nome nem telefone.
 */
export const VISITANTE_COOKIE = "domguima_visitante";
export const VISITANTE_MAX_AGE = 365 * 24 * 60 * 60;

/** 90 dias, o prazo prometido na politica de privacidade. */
export const ORIGEM_MAX_AGE = 90 * 24 * 60 * 60;

/** Teto de cada campo. Quem grava no navegador corta antes (ver origem-storage). */
export const ATTRIBUTION_MAX_LENGTH = 200;

/** Os unicos campos aceitos. Qualquer outra chave do cookie e descartada. */
export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
  "landing_path",
  "fbclid",
  "gclid",
  "first_seen_at",
  "last_utm_source",
  "last_utm_medium",
  "last_utm_campaign",
  "last_seen_at",
] as const satisfies ReadonlyArray<keyof OrderAttribution>;

/** Quebra de linha, tab e outros caracteres de controle: nao podem ir parar na mensagem do WhatsApp. */
const CONTROLE = /[\u0000-\u001f\u007f]+/g;

/**
 * Qualquer valor → so os campos conhecidos, como texto curto e sem caractere
 * de controle. Nunca falha: campo grande demais e CORTADO em vez de reprovar
 * tudo — uma campanha com nome comprido nao pode custar o pedido do cliente.
 */
export function cleanAttribution(value: unknown): OrderAttribution {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const bruto = value as Record<string, unknown>;
  const limpo: OrderAttribution = {};
  for (const chave of ATTRIBUTION_KEYS) {
    const valor = bruto[chave];
    if (typeof valor !== "string") continue;
    const texto = valor.replace(CONTROLE, " ").trim().slice(0, ATTRIBUTION_MAX_LENGTH);
    if (texto) limpo[chave] = texto;
  }
  return limpo;
}

/** Tem algo alem de "entrou direto"? E o que decide se um contato novo pode substituir o anterior. */
export function hasTrafficSignal(attribution: OrderAttribution): boolean {
  return Boolean(attribution.utm_source || attribution.utm_campaign || attribution.utm_medium || attribution.fbclid || attribution.gclid || attribution.referrer);
}

/**
 * Junta o contato de agora com o que o navegador ja tinha. Devolve o que
 * gravar, ou `null` quando nada muda.
 *
 * Regras, nesta ordem:
 *   1. Nada guardado: guarda o contato de agora (mesmo que seja direto — a
 *      pagina de entrada e a data ja servem).
 *   2. O guardado era "direto" e agora chegou algo rastreavel (UTM, anuncio,
 *      site de fora): o rastreavel vale. Sem isso, quem abriu o site uma vez
 *      digitando o endereco e depois voltou pelo anuncio nunca seria creditado
 *      ao anuncio. A data da primeira visita e mantida.
 *   3. Ja havia origem rastreavel e chegou OUTRA campanha: a primeira continua
 *      valendo para o relatorio e a nova fica em `last_*` — o atendente ve a
 *      campanha mais recente na mensagem do WhatsApp.
 *   4. Qualquer outra coisa (navegar pelo site, recarregar a mesma campanha):
 *      nada muda.
 */
export function mergeAttribution(saved: OrderAttribution | null, touch: OrderAttribution, now: string): OrderAttribution | null {
  if (!saved) return { ...touch, first_seen_at: now };
  if (!hasTrafficSignal(saved) && hasTrafficSignal(touch)) {
    return { ...touch, first_seen_at: saved.first_seen_at ?? now };
  }

  if (!touch.utm_source && !touch.utm_campaign) return null;
  const ultimaFonte = saved.last_utm_source ?? saved.utm_source ?? "";
  const ultimaCampanha = saved.last_utm_campaign ?? saved.utm_campaign ?? "";
  if ((touch.utm_source ?? "") === ultimaFonte && (touch.utm_campaign ?? "") === ultimaCampanha) return null;

  // A campanha anterior sai inteira: misturar a fonte de uma com o meio de
  // outra criaria uma combinacao que nunca existiu.
  const primeiro: OrderAttribution = { ...saved };
  delete primeiro.last_utm_source;
  delete primeiro.last_utm_medium;
  delete primeiro.last_utm_campaign;
  delete primeiro.last_seen_at;
  return {
    ...primeiro,
    ...(touch.utm_source ? { last_utm_source: touch.utm_source } : {}),
    ...(touch.utm_medium ? { last_utm_medium: touch.utm_medium } : {}),
    ...(touch.utm_campaign ? { last_utm_campaign: touch.utm_campaign } : {}),
    last_seen_at: now,
  };
}

/**
 * Classifica a origem: o que o relatorio de trafego soma.
 *
 * Prioridade: `utm_source` explicito (quem montou o link disse de onde e) →
 * marcador de anuncio (fbclid/gclid) → dominio do site que trouxe o cliente →
 * direto. Trafego do app do Instagram e do WhatsApp costuma chegar sem
 * referrer; sem UTM no link, ele cai em "Direto" — e por isso o painel tem o
 * gerador de links em /painel/trafego (que usa esta mesma funcao para mostrar
 * como o link vai aparecer no relatorio).
 */
export function classifyTrafficSource(attribution: OrderAttribution): TrafficSource {
  const explicita = sourceFromUtm(attribution.utm_source);
  if (explicita) return explicita;
  if (attribution.fbclid) return "facebook";
  if (attribution.gclid) return "google";
  const host = referrerHost(attribution.referrer);
  if (host) return sourceFromHost(host);
  return "direct";
}

function sourceFromUtm(value: string | undefined): TrafficSource | null {
  // "Mercado Livre", "mercado_livre" e "MercadoLivre" sao a mesma coisa.
  const valor = normalize(value ?? "").replace(/[^a-z0-9]+/g, "");
  if (!valor) return null;
  if (valor === "ig" || valor.startsWith("insta")) return "instagram";
  if (valor === "fb" || valor.startsWith("facebook") || valor.startsWith("meta") || valor.startsWith("messenger")) return "facebook";
  if (valor === "wa" || valor === "wpp" || valor.startsWith("whats") || valor.startsWith("zap")) return "whatsapp";
  if (valor.startsWith("google") || valor === "gads" || valor.startsWith("adwords")) return "google";
  if (valor.startsWith("shope")) return "shopee";
  if (valor === "ml" || valor.startsWith("mercadoli")) return "mercado_livre";
  if (valor.startsWith("magalu") || valor.startsWith("magazineluiza")) return "magalu";
  if (valor.startsWith("loja") || valor === "store" || valor.startsWith("balcao") || valor.startsWith("fachada")) return "store";
  if (valor.startsWith("indica") || valor.startsWith("referral") || valor.startsWith("parceir")) return "referral";
  if (valor === "direct" || valor === "direto") return "direct";
  return "other";
}

/**
 * Dominio a partir do que foi guardado: o navegador grava so o host, mas um
 * valor antigo ou editado pode vir como URL inteira ("android-app://com.instagram.android").
 */
export function referrerHost(value: string | undefined): string {
  const texto = (value ?? "").trim().toLowerCase();
  if (!texto) return "";
  try {
    const host = texto.includes("://") ? new URL(texto).hostname : texto.split("/")[0];
    return host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sourceFromHost(host: string): TrafficSource {
  if (host.includes("instagram")) return "instagram";
  if (host.includes("facebook") || host === "fb.com" || host.endsWith(".fb.com") || host === "fb.me" || host.includes("messenger")) return "facebook";
  if (host.includes("whatsapp") || host === "wa.me") return "whatsapp";
  if (/(^|\.)google\./.test(host) || host.includes("googleadservices") || host.includes("googlesyndication") || host.includes("googlequicksearchbox")) return "google";
  if (host.includes("shopee")) return "shopee";
  if (host.includes("mercadolivre") || host.includes("mercadolibre")) return "mercado_livre";
  if (host.includes("magazineluiza") || host.includes("magalu")) return "magalu";
  return "referral";
}
