import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Rating } from "@/components/ui/Rating";
import { googleStats, shopeeStats, site, social } from "@/config/site";
import { getAllProducts, getCatalogCategories, getProductBySlug, getRelatedProducts } from "@/lib/catalog/queries";
import type { Product } from "@/lib/catalog/types";
import { discountPercent, formatWeight } from "@/lib/utils/format";
import { absoluteUrl, JsonLd } from "@/lib/utils/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return (await getAllProducts()).map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Produto não encontrado" };

  // Meta description a partir da descrição real, cortada em limite de frase.
  const description = product.description.slice(0, 155).trimEnd();
  const image = product.images[0]?.src;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/produto/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: `/produto/${product.slug}`,
      images: image ? [{ url: image, alt: product.images[0].alt }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const category = (await getCatalogCategories()).find((item) => item.id === product.categoryId);
  const related = await getRelatedProducts(product);
  const productUrl = absoluteUrl(`/produto/${product.slug}`);
  const discount = discountPercent(product.price, product.oldPrice);

  return (
    <div className="site-shell py-6">
      <JsonLd data={productJsonLd(product, productUrl)} />

      <Breadcrumbs
        items={[
          { label: "Início", href: "/" },
          ...(category
            ? [{ label: category.name, href: `/categoria/${category.slug}` }]
            : []),
          { label: product.name },
        ]}
        siteUrl={site.url}
      />

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-10 xl:grid-cols-[minmax(0,1.15fr)_460px] xl:gap-14">
        <div>
          <ProductGallery images={product.images} />
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {discount > 0 && <Badge variant="promo">-{discount}% OFF</Badge>}
            {product.isBestSeller && <Badge variant="best">Mais vendido</Badge>}
            {product.brand && <Badge variant="neutral">{product.brand}</Badge>}
          </div>

          <h1 className="text-xl font-extrabold leading-snug tracking-tight text-ink-900 sm:text-2xl">
            {product.name}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
            {product.rating !== undefined ? (
              <Rating
                value={product.rating}
                reviewCount={product.reviewCount}
                size="md"
              />
            ) : (
              <span className="text-ink-400">Ainda sem avaliações</span>
            )}
            {product.soldCount !== undefined && (
              <span>{product.soldCount} vendidos</span>
            )}
            <span className="text-ink-400">SKU {product.sku}</span>
          </div>

          <hr className="my-5 border-ink-100" />

          <ProductPurchase product={product} productUrl={productUrl} />

          <section aria-label="Avaliações da loja" className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-400">
              Reputação da loja
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StoreRatingLink
                href={googleStats.profileUrl}
                label="Google"
                rating="5,0"
                count={googleStats.ratingCount}
              />
              <StoreRatingLink
                href={social.shopee}
                label="Shopee"
                rating="4,88"
                count={shopeeStats.ratingCount}
              />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
              Avaliações dos canais da loja; não são avaliações específicas deste produto.
            </p>
          </section>
        </div>
      </div>

      {/* Descrição, especificações e envio */}
      <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-10 xl:grid-cols-[minmax(0,1.15fr)_460px] xl:gap-14">
        <div className="space-y-10">
          <section aria-labelledby="descricao">
            <h2
              id="descricao"
              className="mb-3 text-lg font-extrabold tracking-tight text-ink-900"
            >
              Descrição
            </h2>
            <p className="max-w-2xl text-[15px] leading-relaxed text-ink-600">
              {product.description}
            </p>
          </section>

          <section aria-labelledby="especificacoes">
            <h2
              id="especificacoes"
              className="mb-3 text-lg font-extrabold tracking-tight text-ink-900"
            >
              Especificações
            </h2>
            <dl className="max-w-2xl overflow-hidden rounded-card border border-ink-100 bg-white">
              {product.specifications.map((spec, i) => (
                <div
                  key={spec.label}
                  className={`flex gap-4 px-4 py-3 text-sm ${
                    i % 2 === 0 ? "bg-white" : "bg-ink-50/60"
                  }`}
                >
                  <dt className="w-40 shrink-0 font-semibold text-ink-500">
                    {spec.label}
                  </dt>
                  <dd className="text-ink-800">{spec.value}</dd>
                </div>
              ))}
              <div className="flex gap-4 bg-ink-50/60 px-4 py-3 text-sm">
                <dt className="w-40 shrink-0 font-semibold text-ink-500">
                  Dimensões
                </dt>
                <dd className="text-ink-800">
                  {product.shipping.dimensions.length} ×{" "}
                  {product.shipping.dimensions.width} ×{" "}
                  {product.shipping.dimensions.height} cm
                </dd>
              </div>
              <div className="flex gap-4 bg-white px-4 py-3 text-sm">
                <dt className="w-40 shrink-0 font-semibold text-ink-500">Peso</dt>
                <dd className="text-ink-800">
                  {formatWeight(product.shipping.weight)}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-card border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="mb-3 text-base font-extrabold text-ink-900">
              Informações de envio
            </h2>
            <ul className="space-y-3 text-sm text-ink-600">
              <li className="flex gap-3">
                <span aria-hidden>📍</span>
                <span>
                  Enviado de <strong>{product.shipping.origin}</strong> para todo
                  o Brasil.
                </span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden>📦</span>
                <span>
                  Pacote de aproximadamente{" "}
                  {formatWeight(product.shipping.weight)}.
                </span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden>💬</span>
                <span>
                  O valor e o prazo do frete são confirmados com você antes de
                  fechar o pedido.
                </span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden>↩️</span>
                <span>
                  <Link
                    href="/institucional/trocas-e-devolucoes"
                    className="font-semibold text-gold-800 underline-offset-2 hover:underline"
                  >
                    7 dias para arrependimento
                  </Link>
                  , conforme o Código de Defesa do Consumidor.
                </span>
              </li>
            </ul>
          </div>

          {/* Observação real do lojista — nunca texto genérico de marketing. */}
          {product.sellerNote && (
            <div className="rounded-card border border-gold-200 bg-gold-50 p-4 text-sm font-medium text-gold-900">
              {product.sellerNote}
            </div>
          )}

          {/* Só aparece no item que veio mesmo do anúncio da Shopee. */}
          {product.sourceUrl && (
            <div className="rounded-card border border-ink-100 bg-white p-5 shadow-card">
              <p className="text-sm text-ink-600">
                Este produto também está anunciado na nossa loja da Shopee, com{" "}
                {shopeeStats.ratingCount.toLocaleString("pt-BR")} avaliações na
                loja.
              </p>
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block rounded-lg border border-ink-200 px-4 py-2.5 text-center text-sm font-bold text-ink-700 transition-colors hover:border-[#EE4D2D] hover:text-[#EE4D2D]"
              >
                Ver anúncio na Shopee
              </a>
            </div>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <div className="mt-16">
          <ProductCarousel products={related} title="Produtos relacionados" />
        </div>
      )}
    </div>
  );
}

function StoreRatingLink({
  href,
  label,
  rating,
  count,
}: {
  href: string;
  label: string;
  rating: string;
  count: number;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-xl border border-ink-100 bg-white px-3 py-2.5 shadow-card transition-colors hover:border-gold-300 hover:bg-gold-50"
    >
      <span className="block text-sm font-extrabold text-ink-900">
        <span className="mr-1 text-gold-500" aria-hidden>★</span>
        {rating} no {label}
      </span>
      <span className="mt-0.5 block text-[10px] text-ink-500">
        {count.toLocaleString("pt-BR")} avaliações
      </span>
    </a>
  );
}

/**
 * Product Schema. `aggregateRating` só é emitido quando existe avaliação real —
 * marcar nota inventada é violação das diretrizes do Google e rende penalidade.
 */
function productJsonLd(product: Product, url: string) {

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku,
    ...(product.brand
      ? { brand: { "@type": "Brand", name: product.brand } }
      : {}),
    category: product.categoryId,
    image: product.images.map((image) => absoluteUrl(image.src)),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "BRL",
      price: (product.price / 100).toFixed(2),
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: site.legalName },
    },
    ...(product.rating !== undefined && product.reviewCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };
}
