import "server-only";

import { connection } from "next/server";
import { getAllProducts, getCatalogCategories } from "./queries";
import type { Banner, Category, Product } from "./types";

type CommercialReason = "offer" | "new" | "restock" | "rotation";
type Candidate = { product: Product; reason: CommercialReason; score: number };

/**
 * Curadoria automatica da home.
 *
 * A pontuacao e interna: o visitante nunca ve termos como "estoque parado".
 * Produtos sem estoque, sem foto ou retirados da curadoria sao inelegiveis.
 * Datas desconhecidas nao geram alegacoes de novidade ou reposicao.
 *
 * Todo slide e um produto: nome, preco e foto do cadastro. A reputacao da
 * loja (Google e Shopee) fica na linha logo abaixo do banner e na faixa de
 * avaliacoes, e nao repete aqui.
 */
export async function getSmartBanners(): Promise<Banner[]> {
  const [products, categories] = await Promise.all([getAllProducts(), getCatalogCategories()]);
  // A home é pré-renderizada por padrão. `connection()` garante que o sorteio
  // aconteça a cada visita, e não fique congelado no produto sorteado durante
  // o build.
  await connection();
  return bannersDaHome(products, categories);
}

/**
 * Os slides a partir do catálogo: os dois produtos de maior pontuação
 * (categorias diferentes, quando dá) e, por último, um sorteado entre os
 * outros elegíveis, para variar a cada visita.
 */
function bannersDaHome(products: Product[], categories: Category[]): Banner[] {
  const nomes = new Map(categories.map((category) => [category.id, category.name]));
  const eligible = products.filter(
    (product) => product.stock > 0 && Boolean(product.images[0]) && product.heroEnabled !== false,
  );
  const selected = selectDiverse(
    eligible.flatMap(scoreProduct).sort((a, b) => b.score - a.score),
    2,
  );

  const selectedIds = new Set(selected.map(({ product }) => product.id));
  const randomPool = eligible.filter((product) => !selectedIds.has(product.id));
  const sorteado = pickRandom(randomPool.length > 0 ? randomPool : eligible);
  // Com só um ou dois elegíveis, o sorteio cairia num produto que já tem slide.
  const slides =
    sorteado && !selectedIds.has(sorteado.id)
      ? [...selected, { product: sorteado, reason: "rotation" as const, score: 0 }]
      : selected;

  return slides.map((candidate) => toBanner(candidate, nomes.get(candidate.product.categoryId)));
}

function pickRandom(products: Product[]): Product | undefined {
  if (products.length === 0) return undefined;
  return products[Math.floor(Math.random() * products.length)];
}

function scoreProduct(product: Product): Candidate[] {
  const priority = product.heroPriority ?? 0;
  const candidates: Candidate[] = [];
  if (product.isOffer && product.oldPrice && product.oldPrice > product.price) {
    const discount = (product.oldPrice - product.price) / product.oldPrice;
    candidates.push({ product, reason: "offer", score: 180 + discount * 100 + stockPressure(product) + priority });
  }

  const publishedDays = daysSince(product.publishedAt);
  if (publishedDays !== null && publishedDays <= 45) {
    candidates.push({ product, reason: "new", score: 155 + (45 - publishedDays) + stockPressure(product) + priority });
  }

  const restockDays = daysSince(product.lastStockEntryAt);
  if (restockDays !== null && restockDays <= 21) {
    candidates.push({ product, reason: "restock", score: 140 + (21 - restockDays) + stockPressure(product) + priority });
  }

  const saleDays = daysSince(product.lastSaleAt);
  const ageSignal = saleDays === null ? 0 : Math.min(saleDays, 90) * 0.45;
  candidates.push({
    product,
    reason: "rotation",
    score: 75 + stockPressure(product) + ageSignal + priority + (product.isFeatured ? 8 : 0),
  });
  return candidates;
}

function stockPressure(product: Product): number {
  const inventory = Math.min(product.stock, 60) * 1.4;
  const provenDemand = Math.min(product.soldCount ?? 0, 80) * 0.25;
  return inventory - provenDemand;
}

function selectDiverse(candidates: Candidate[], limit: number): Candidate[] {
  const selected: Candidate[] = [];
  const products = new Set<string>();
  const categories = new Set<string>();
  for (const candidate of candidates) {
    if (products.has(candidate.product.id) || categories.has(candidate.product.categoryId)) continue;
    selected.push(candidate);
    products.add(candidate.product.id);
    categories.add(candidate.product.categoryId);
    if (selected.length === limit) return selected;
  }
  for (const candidate of candidates) {
    if (products.has(candidate.product.id)) continue;
    selected.push(candidate);
    products.add(candidate.product.id);
    if (selected.length === limit) break;
  }
  return selected;
}

/**
 * O título é o nome do produto, e não uma frase de campanha ("Uma
 * oportunidade que vale conhecer" escondia o produto). O desconto aparece no
 * preço (riscado e −X%), então não se repete no texto.
 */
function toBanner({ product, reason }: Candidate, categoria?: string): Banner {
  return {
    id: `automatico-${reason}-${product.id}`,
    title: product.name,
    detail: detalhe(reason, categoria),
    ctaLabel: reason === "offer" ? "Ver oferta" : "Ver produto",
    href: `/produto/${product.slug}`,
    image: product.images[0],
    price: { price: product.price, oldPrice: product.oldPrice, cardInstallment: product.cardInstallment },
  };
}

/**
 * Só o que a data do painel confirma: publicado há até 45 dias é "novo no
 * catálogo"; entrada de estoque há até 21 dias é "estoque reposto". Sem data,
 * fica só a categoria.
 */
function detalhe(reason: CommercialReason, categoria?: string): string {
  const fato = reason === "new" ? "novo no catálogo" : reason === "restock" ? "estoque reposto" : "";
  if (!categoria) return fato ? fato[0].toUpperCase() + fato.slice(1) : "";
  return fato ? `${categoria} · ${fato}` : categoria;
}

function daysSince(value?: string): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}
