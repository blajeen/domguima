import "server-only";

import { z } from "zod";
import { askWithWebSearch } from "./openai-web";
import { fetchPublic } from "./remote-fetch";

/**
 * Menor preco do MESMO modelo e variante no mercado, so para referencia: o
 * preco da loja continua sendo o que o dono digitou.
 *
 * A pesquisa aponta as ofertas; cada uma e conferida aqui, abrindo a pagina
 * da loja: o preco precisa aparecer nela (texto ou JSON-LD) e o modelo/GTIN
 * tambem. Loja que monta a pagina so no navegador nao passa na conferencia e
 * aparece como "nao conferida", nunca como menor preco.
 */
export interface MarketOffer {
  store: string;
  seller: string;
  priceCents: number;
  payment: string;
  coupon: string;
  shipping: string;
  url: string;
  /** O preco apareceu na pagina da loja. */
  priceChecked: boolean;
  /** O modelo ou o GTIN apareceu na pagina da loja. */
  productChecked: boolean;
}

export interface MarketPriceResult {
  checkedAt: string;
  lowest: MarketOffer | null;
  offers: MarketOffer[];
}

const offersSchema = z.object({
  offers: z.array(z.object({
    store: z.string().trim().max(80), seller: z.string().trim().max(80), price: z.number(),
    payment: z.string().trim().max(120), coupon: z.string().trim().max(80), shipping: z.string().trim().max(160), url: z.string().trim().max(1_000),
  })).max(8),
});

export async function findMarketPrice(input: { name: string; brand: string; model: string; gtin: string; color: string; voltage: string }): Promise<MarketPriceResult> {
  const resposta = offersSchema.parse(await askWithWebSearch({
    schemaName: "market_offers",
    timeoutMs: 30_000,
    maxToolCalls: 5,
    instructions: [
      "Pesquise ofertas atuais, em lojas brasileiras, do produto EXATO informado: mesma marca, mesmo modelo e, quando informadas, mesma cor e voltagem. Não aceite modelos parecidos, kits, usados ou recondicionados.",
      "Retorne até 6 ofertas com a URL da página do produto na loja (não da busca), o nome da loja, o vendedor (no marketplace, o lojista parceiro; senão repita a loja), o preço em reais como número, a forma de pagamento desse preço (ex.: Pix, à vista no cartão), o cupom necessário (vazio se nenhum) e o frete (ou 'depende do CEP').",
      "Use só o que estiver na página da oferta; não use apenas o resumo do buscador. Se não houver oferta confiável, retorne lista vazia.",
    ].join(" "),
    input,
    schema: { type: "object", additionalProperties: false, required: ["offers"], properties: { offers: { type: "array", items: { type: "object", additionalProperties: false, required: ["store", "seller", "price", "payment", "coupon", "shipping", "url"], properties: { store: { type: "string" }, seller: { type: "string" }, price: { type: "number" }, payment: { type: "string" }, coupon: { type: "string" }, shipping: { type: "string" }, url: { type: "string" } } } } } },
  }));

  const codigos = [input.model, input.gtin].map((valor) => valor.replace(/[^a-z0-9]/gi, "").toLowerCase()).filter((valor) => valor.length >= 4);
  const offers = await Promise.all(resposta.offers
    .filter((oferta) => /^https?:\/\//.test(oferta.url) && oferta.price > 0)
    .map(async (oferta): Promise<MarketOffer> => {
      const priceCents = Math.round(oferta.price * 100);
      const base = { store: oferta.store, seller: oferta.seller, priceCents, payment: oferta.payment, coupon: oferta.coupon, shipping: oferta.shipping || "depende do CEP", url: oferta.url };
      try {
        const html = (await fetchPublic(oferta.url, { maxBytes: 4 * 1024 * 1024, timeoutMs: 10_000, accept: (type) => type === "text/html" || type === "application/xhtml+xml" })).buffer.toString("utf8");
        const compacto = html.replace(/[^a-z0-9]/gi, "").toLowerCase();
        return { ...base, priceChecked: pageHasPrice(html, priceCents), productChecked: codigos.length === 0 || codigos.some((codigo) => compacto.includes(codigo)) };
      } catch {
        return { ...base, priceChecked: false, productChecked: false };
      }
    }));
  offers.sort((a, b) => a.priceCents - b.priceCents);
  return {
    checkedAt: new Date().toISOString(),
    lowest: offers.find((oferta) => oferta.priceChecked && oferta.productChecked) ?? null,
    offers,
  };
}

/** O preco aparece na pagina: "1.299,90", "1299,90", "1299.90" ou price do JSON-LD. */
export function pageHasPrice(html: string, cents: number): boolean {
  const reais = Math.floor(cents / 100);
  const centavos = String(cents % 100).padStart(2, "0");
  const milhar = reais.toLocaleString("pt-BR");
  const formas = [`${milhar},${centavos}`, `${reais},${centavos}`, `${reais}.${centavos}`];
  const texto = html.replace(/&nbsp;| /g, " ");
  if (formas.some((forma) => new RegExp(`(^|[^\\d.,])${forma.replace(/\./g, "\\.")}(?![\\d])`).test(texto))) return true;
  // JSON-LD e atributos: "price": 699.9 ou "price":"699.90"
  return [...texto.matchAll(/"(?:price|lowPrice)"\s*:\s*"?(\d+(?:\.\d+)?)"?/g)].some((item) => Math.round(Number(item[1]) * 100) === cents);
}
