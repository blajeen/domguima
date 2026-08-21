/**
 * Peças compartilhadas entre os dois importadores da Shopee:
 *
 *   import-shopee.mjs         — usa cookie salvo em shopee-cookie.txt
 *   shopee-login-import.mjs   — abre navegador, você loga, importa na hora
 *
 * Fica num módulo à parte porque nenhum dos dois scripts deve rodar sua
 * `main()` só por ser importado pelo outro.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SHOP_USERNAME = "domguima";
export const SHOP_ID = 772602809;
export const OUTPUT_JSON = join(ROOT, "src/lib/catalog/shopee-catalog.json");
export const IMAGE_ROOT = join(ROOT, "public/produtos");
export const CDN = "https://down-br.img.susercontent.com/file";
export const COOKIE_FILE = join(ROOT, "shopee-cookie.txt");

export const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Mapeia a categoria da Shopee para as categorias do site. */
export const CATEGORY_RULES = [
  { id: "smart-tvs", terms: ["smart tv", "televis", "tv "," tv", "soundbar", "suporte de tv"] },
  { id: "climatizacao", terms: ["ventilador", "climatizador", "circulador", "ar condicionado", "umidificador"] },
  { id: "eletrodomesticos", terms: ["air fryer", "fritadeira", "liquidificador", "cafeteira", "batedeira", "ferro", "micro-ondas", "microondas", "sanduicheira", "grill", "frigobar", "geladeira", "forno"] },
  { id: "celulares", terms: ["carregador", "cabo", "fone", "power bank", "smartwatch", "capa", "pelicula", "suporte celular"] },
  { id: "informatica", terms: ["mouse", "teclado", "notebook", "pen drive", "webcam", "hub usb", "adaptador"] },
  { id: "eletronicos", terms: ["caixa de som", "caixa amplificada", "headset", "radio", "som"] },
  { id: "casa-decoracao", terms: ["luminaria", "led", "panela", "aspirador", "purificador", "organizador", "decora"] },
];

export function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

export function detectCategory(name) {
  const lower = name.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.terms.some((term) => lower.includes(term))) return rule.id;
  }
  return "eletronicos";
}

/** Shopee guarda preço em micro-unidades (x100000). Nós usamos centavos. */
export const toCents = (micro) => (micro ? Math.round(micro / 1000) : undefined);

export async function downloadImages(slug, hashes, headers) {
  const dir = join(IMAGE_ROOT, slug);
  await mkdir(dir, { recursive: true });

  const images = [];
  for (const [i, hash] of hashes.slice(0, 6).entries()) {
    const file = join(dir, `${i + 1}.jpg`);
    const publicPath = `/produtos/${slug}/${i + 1}.jpg`;

    if (existsSync(file)) {
      images.push(publicPath);
      continue;
    }
    try {
      const res = await fetch(`${CDN}/${hash}`, { headers });
      if (!res.ok) continue;
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      images.push(publicPath);
    } catch (error) {
      console.warn(`  ! imagem ${hash} falhou: ${error.message}`);
    }
  }
  return images;
}

export function mapItem(item, images) {
  const slug = `${slugify(item.name)}-${item.itemid}`;
  const price = toCents(item.price ?? item.price_min);
  const oldPrice = toCents(item.price_before_discount ?? item.price_min_before_discount);
  const rating = item.item_rating?.rating_star;

  return {
    id: String(item.itemid),
    externalId: item.itemid,
    name: item.name,
    slug,
    description: item.description?.trim() || item.name,
    price,
    ...(oldPrice && oldPrice > price ? { oldPrice } : {}),
    categoryId: detectCategory(item.name),
    ...(item.brand ? { brand: item.brand } : {}),
    sku: String(item.itemid),
    stock: item.stock ?? 0,
    images: images.map((src, i) => ({ src, alt: `${item.name} — foto ${i + 1}` })),
    ...(item.tier_variations?.length
      ? {
          variants: item.tier_variations
            .filter((v) => v.options?.length)
            .map((v) => ({
              name: v.name.charAt(0) + v.name.slice(1).toLowerCase(),
              options: v.options,
            })),
        }
      : {}),
    specifications: [
      ...(item.brand ? [{ label: "Marca", value: item.brand }] : []),
      { label: "Origem", value: item.shop_location || "Minas Gerais" },
    ],
    shipping: {
      weight: Math.round((item.weight ?? 0.5) * 1000),
      dimensions: { length: 20, width: 15, height: 10 },
      origin: item.shop_location || "Minas Gerais",
    },
    ...(rating ? { rating: Math.round(rating * 100) / 100 } : {}),
    ...(item.cmt_count ? { reviewCount: item.cmt_count } : {}),
    ...(item.historical_sold ? { soldCount: item.historical_sold } : {}),
    isFeatured: (item.historical_sold ?? 0) > 20,
    isBestSeller: (item.historical_sold ?? 0) > 30,
    isOffer: Boolean(oldPrice && oldPrice > price),
    tags: item.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 8),
    dataSource: "shopee-verified",
    sourceUrl: `https://shopee.com.br/product/${SHOP_ID}/${item.itemid}`,
  };
}

/**
 * Baixa as imagens, converte e grava o catálogo.
 *
 * Recusa sobrescrever se `collected` não for uma listagem completa (<=1
 * item) — o endpoint aberto de SEO devolve só o item em destaque, e gravar
 * esse único produto deixaria a loja com UM item no ar, bem pior do que a
 * vitrine atual.
 */
export async function writeCatalog(collected, headers) {
  if (collected.length <= 1) {
    return { written: false, count: collected.length };
  }

  console.log(`\n→ Baixando imagens de ${collected.length} produto(s)...`);
  const products = [];
  for (const item of collected) {
    const slug = `${slugify(item.name)}-${item.itemid}`;
    const images = await downloadImages(slug, item.images ?? [item.image], headers);
    if (images.length === 0) {
      console.warn(`  ! ${item.name} ficou sem imagem — pulado.`);
      continue;
    }
    products.push(mapItem(item, images));
  }

  await writeFile(OUTPUT_JSON, `${JSON.stringify(products, null, 2)}\n`);
  return { written: true, count: products.length };
}
