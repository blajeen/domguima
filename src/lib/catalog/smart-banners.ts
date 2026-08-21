import "server-only";

import { connection } from "next/server";
import { company, googleStats, shopeeStats, social } from "@/config/site";
import { loadPublicStoreSettings } from "./database";
import { getAllProducts } from "./queries";
import type { Banner, Product } from "./types";
import { formatPrice } from "@/lib/utils/format";

type CommercialReason = "offer" | "new" | "restock" | "rotation";
type Candidate = { product: Product; reason: CommercialReason; score: number };

/**
 * Curadoria automatica da home.
 *
 * A pontuacao e interna: o visitante nunca ve termos como "estoque parado".
 * Produtos sem estoque, sem foto ou retirados da curadoria sao inelegiveis.
 * Datas desconhecidas nao geram alegacoes de novidade ou reposicao.
 */
export async function getSmartBanners(): Promise<Banner[]> {
  const [products, settings] = await Promise.all([getAllProducts(), loadPublicStoreSettings()]);
  const eligibleProducts = products.filter(
    (product) => product.stock > 0 && Boolean(product.images[0]) && product.heroEnabled !== false,
  );
  const candidates = eligibleProducts
    .flatMap(scoreProduct)
    .sort((a, b) => b.score - a.score);

  const selected = selectDiverse(candidates, 2);
  const commercial = selected.map((candidate, index) => toBanner(candidate, index));

  // A home é pré-renderizada por padrão. `connection()` garante que a escolha
  // abaixo aconteça a cada visita, e não fique congelada no produto sorteado
  // durante o build. Os produtos ja usados nos banners comerciais ficam fora
  // do sorteio para aumentar a variedade do carrossel.
  await connection();
  const selectedIds = new Set(selected.map(({ product }) => product.id));
  const randomPool = eligibleProducts.filter((product) => !selectedIds.has(product.id));
  const randomProduct = pickRandom(randomPool.length > 0 ? randomPool : eligibleProducts);
  const randomBanner = randomProduct ? toRandomBanner(randomProduct) : null;

  const googleRating = Number(settings.googleRating.replace(",", ".")) || googleStats.ratingAverage;
  const googleCount = Number(settings.googleRatingCount) || googleStats.ratingCount;
  const experienceYears = completedYears(company.openedAt);
  const reputation: Banner = {
    id: "reputacao-verificada",
    eyebrow: `Desde ${company.openedAt.slice(-4)} ao lado dos clientes`,
    title: `${experienceYears} anos de experiência e confiança comprovada`,
    subtitle: `A Dom Guima reúne ${googleCount.toLocaleString("pt-BR")} avaliações no Google e ${shopeeStats.ratingCount.toLocaleString("pt-BR")} na Shopee. Consulte os perfis oficiais.`,
    ctaLabel: "Conferir avaliações",
    href: settings.googleUrl || social.google,
    theme: "deep",
    categoryId: "reputacao",
    reputation: {
      googleRating,
      googleCount,
      shopeeRating: shopeeStats.ratingAverage,
      shopeeCount: shopeeStats.ratingCount,
      googleVerifiedAt: settings.googleVerifiedAt || googleStats.verifiedAt,
      shopeeVerifiedAt: shopeeStats.verifiedAt,
    },
  };

  return [...commercial, ...(randomBanner ? [randomBanner] : []), reputation];
}

function pickRandom(products: Product[]): Product | undefined {
  if (products.length === 0) return undefined;
  return products[Math.floor(Math.random() * products.length)];
}

function toRandomBanner(product: Product): Banner {
  return {
    id: `produto-surpresa-${product.id}`,
    eyebrow: "Produto surpresa Dom Guima",
    title: product.name,
    subtitle: `${formatPrice(product.price)} à vista. Descubra uma escolha aleatória do nosso catálogo a cada visita.`,
    ctaLabel: "Conhecer produto",
    href: `/produto/${product.slug}`,
    theme: "deep",
    categoryId: product.categoryId,
    image: product.images[0],
  };
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

function toBanner({ product, reason }: Candidate, index: number): Banner {
  const content = commercialCopy(product, reason);
  return {
    id: `automatico-${reason}-${product.id}`,
    ...content,
    href: `/produto/${product.slug}`,
    theme: index === 0 ? "gold" : "ink",
    categoryId: product.categoryId,
    image: product.images[0],
  };
}

function commercialCopy(product: Product, reason: CommercialReason): Pick<Banner, "eyebrow" | "title" | "subtitle" | "ctaLabel"> {
  if (reason === "offer" && product.oldPrice) {
    const discount = Math.round((1 - product.price / product.oldPrice) * 100);
    return {
      eyebrow: "Oportunidade selecionada",
      title: `${discount}% de desconto em uma escolha do catálogo`,
      subtitle: `${product.name} por ${formatPrice(product.price)}, enquanto houver estoque.`,
      ctaLabel: "Conferir oferta",
    };
  }
  if (reason === "new") return { eyebrow: "Novidade no catálogo", title: "Acabou de chegar à Dom Guima", subtitle: `${product.name}, disponível para atendimento e compra assistida.`, ctaLabel: "Conhecer novidade" };
  if (reason === "restock") return { eyebrow: "Estoque atualizado", title: "De volta e pronto para o seu pedido", subtitle: `${product.name} está disponível novamente no catálogo.`, ctaLabel: "Ver produto" };
  return { eyebrow: "Seleção inteligente da semana", title: "Uma oportunidade que vale conhecer", subtitle: `${product.name}, disponível para envio com atendimento direto da Dom Guima.`, ctaLabel: "Ver detalhes" };
}

function daysSince(value?: string): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function completedYears(openedAt: string): number {
  const [day, month, year] = openedAt.split("/").map(Number);
  const today = new Date();
  let years = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) years -= 1;
  return years;
}
