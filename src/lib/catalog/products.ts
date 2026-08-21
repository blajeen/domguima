import shopeeCatalog from "./shopee-catalog.json";
import { lojaProducts } from "./loja-produtos";
import type { Product, ProductVariant } from "./types";

/**
 * CATÁLOGO DA DOM GUIMA
 * =====================
 *
 * Cada produto declara `dataSource`, e isso não é decoração:
 *
 *  "shopee-verified" → veio da loja oficial (shopee.com.br/domguima) via API
 *     pública em 19/08/2026. ID, preço, fotos, estoque, nota e vendas são REAIS.
 *
 *  "loja-verified" → preço, marca, especificação e voltagem vieram da lista de
 *     vendas que o próprio lojista usa no WhatsApp (recebida em 20/08/2026,
 *     ver src/lib/catalog/loja-produtos.ts). Real, mas ainda sem foto do
 *     produto em si — usa ilustração até a foto real ser adicionada.
 *
 * Não existe mais item "placeholder" inventado no catálogo padrão: assim que
 * tivemos dado real suficiente (79 produtos verificados na Shopee + a lista
 * de vendas do lojista), os itens de vitrine foram removidos.
 *
 * Para importar o catálogo completo da Shopee: `npm run login:shopee` ou
 * `npm run import:shopee` (ver scripts/). Nenhum componente lê produto
 * direto — tudo passa por `queries.ts`.
 */

export const VOLTAGEM: ProductVariant = { name: "Voltagem", options: ["110V", "220V"] };

/**
 * DADO REAL — Ferro a Vapor Arno, anúncio ativo da Dom Guima na Shopee.
 * Lido de /api/v4/shop/get_shop_seo?shopid=772602809 em 19/08/2026.
 * Preços convertidos de micro-unidades Shopee (÷1000) para centavos.
 */
const verifiedProducts: Product[] = [
  {
    id: "ferro-vapor-arno-essentialgliss",
    externalId: 23498051812,
    name: "Ferro a Vapor Arno Essentialgliss Base Antiaderente 1100W - FV1051B2",
    slug: "ferro-vapor-arno-essentialgliss-fv1051b2",
    description:
      "Ferro a vapor Arno Essentialgliss com 1100W e base antiaderente, que desliza bem no tecido sem enroscar. Tem vapor contínuo para desamassar peça difícil, spray de água para dobra marcada e controle de temperatura por tipo de tecido. Leve o suficiente para passar bastante roupa sem cansar o braço.",
    price: 12990,
    oldPrice: 19990,
    categoryId: "eletrodomesticos",
    brand: "Arno",
    sku: "FV1051B2",
    stock: 1,
    images: Array.from({ length: 5 }, (_, i) => ({
      src: `/produtos/ferro-vapor-arno-essentialgliss/${i + 1}.jpg`,
      alt: `Ferro a Vapor Arno Essentialgliss FV1051B2 — foto ${i + 1}`,
    })),
    variants: [VOLTAGEM],
    specifications: [
      { label: "Marca", value: "Arno" },
      { label: "Modelo", value: "Essentialgliss FV1051B2" },
      { label: "Potência", value: "1100W" },
      { label: "Base", value: "Antiaderente" },
      { label: "Vapor", value: "Contínuo, com spray de água" },
      { label: "Controle de temperatura", value: "Por tipo de tecido" },
    ],
    shipping: {
      weight: 1200,
      dimensions: { length: 30, width: 14, height: 16 },
      origin: "Minas Gerais",
    },
    rating: 5,
    reviewCount: 15,
    soldCount: 36,
    isFeatured: true,
    isBestSeller: true,
    isOffer: true,
    tags: ["ferro de passar", "ferro a vapor", "arno", "roupa", "passar roupa"],
    dataSource: "shopee-verified",
    sourceUrl: "https://shopee.com.br/product/772602809/23498051812",
  },
];

/**
 * Catálogo importado da Shopee por `npm run import:shopee` / `npm run
 * login:shopee`. Começa vazio. Assim que tiver produtos, ele vira O catálogo
 * do site e os demais saem de cena sozinhos — sem tocar em componente nenhum.
 */
const importedProducts = shopeeCatalog as unknown as Product[];

/**
 * Imagens em `/produtos/<pasta>/` possuem uma `cover.webp` revisada e
 * padronizada. Ela deve ser sempre a imagem principal da vitrine; as fotos
 * originais continuam disponíveis na galeria da página do produto.
 */
function withStandardizedCover(catalog: Product[]): Product[] {
  return catalog.map((product) => {
    const localImage = product.images.find((image) =>
      image.src.startsWith("/produtos/"),
    );
    const folder = localImage?.src.match(/^\/produtos\/([^/]+)\//)?.[1];

    if (!folder) return product;

    const coverSrc = `/produtos/${folder}/cover.webp`;

    if (product.images[0]?.src === coverSrc) return product;

    return {
      ...product,
      images: [
        {
          src: coverSrc,
          alt: `${product.name} — foto principal`,
        },
        ...product.images.filter((image) => image.src !== coverSrc),
      ],
    };
  });
}

const activeCatalog: Product[] =
  importedProducts.length > 0
    ? importedProducts
    : [...verifiedProducts, ...lojaProducts];

export const products: Product[] = withStandardizedCover(activeCatalog);
