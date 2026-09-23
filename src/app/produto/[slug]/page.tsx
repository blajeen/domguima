import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { ProductGallery } from "@/components/product/ProductGallery";
import { VariantImageProvider } from "@/components/product/VariantImageContext";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { buttonStyles } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Rating } from "@/components/ui/Rating";
import { site } from "@/config/site";
import {
  dividirFicha,
  fotosDaGaleria,
  nomeFotoProduto,
  numerosDoProduto,
  type NumeroDoProduto,
} from "@/lib/catalog/apresentacao";
import { getAllProducts, getCatalogCategories, getProductBySlug, getRelatedProducts } from "@/lib/catalog/queries";
import { reputacaoDaLoja, type CanalReputacao } from "@/lib/catalog/reputacao";
import type { Product, Specification } from "@/lib/catalog/types";
import { formatDate, formatNota, formatWeight } from "@/lib/utils/format";
import { absoluteUrl, JsonLd } from "@/lib/utils/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Rede de seguranca do cache.
 *
 * O salvamento do painel ja revalida esta rota na hora (refreshCatalog). Este
 * teto existe para o caso de a revalidacao falhar: sem ele a pagina ficava
 * congelada no build ate o proximo deploy, e um produto reabastecido continuava
 * anunciado como indisponivel por dias.
 */
export const revalidate = 300;

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

/*
 * As duas faixas da página (galeria + compra, detalhes + envio) usam as mesmas
 * colunas. A coluna da galeria é limitada de propósito: solta, ela esticava
 * até ~1000px em tela grande e ampliava a foto muito além do tamanho real,
 * borrando a imagem. Abaixo de lg a página vira uma coluna de até 42rem,
 * centralizada, para a foto não ocupar a altura inteira do tablet.
 */
const largura = "mx-auto max-w-2xl lg:max-w-[1040px] xl:max-w-[1120px]";
const colunas = `${largura} grid gap-8 lg:grid-cols-[minmax(0,540px)_minmax(0,440px)] lg:gap-10 xl:grid-cols-[minmax(0,600px)_minmax(0,460px)] xl:gap-14`;

// Todos os títulos de seção da página no mesmo tamanho (inclusive o dos
// relacionados, ver `compacto` no SectionHeader) e abaixo do H1 do produto.
const tituloDeSecao = "text-balance text-titulo font-bold text-grafite-900";

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const category = (await getCatalogCategories()).find((item) => item.id === product.categoryId);
  const related = await getRelatedProducts(product);
  const { google, shopee } = await reputacaoDaLoja();
  const productUrl = absoluteUrl(`/produto/${product.slug}`);
  // A pagina abre na mesma opcao que o seletor comeca marcada: a primeira com
  // estoque. Calcular aqui evita a galeria trocar de foto depois de montar.
  const opcaoInicial = product.variantOptions?.find((item) => item.stock > 0) ?? product.variantOptions?.[0];

  const fotos = fotosDaGaleria(product.images);
  const numeros = numerosDoProduto(product);
  const { destaques, ficha } = dividirFicha(product.specifications);
  const tabela = fichaComMedidas(ficha, product);
  // Nota só com avaliação de verdade: nada de "Ainda sem avaliações" em destaque.
  const temAvaliacao = product.rating !== undefined && product.reviewCount !== 0;
  // No máximo um selo, como no card. O desconto já está no preço (−X%).
  const selo = product.isBestSeller ? (
    <Badge variant="destaque">Mais vendido</Badge>
  ) : product.isExclusive ? (
    <Badge variant="exclusivo">Só na Dom Guima</Badge>
  ) : null;

  return (
    <div className="site-shell py-4 sm:py-6">
      <JsonLd data={productJsonLd(product, productUrl)} />

      {/* A trilha alinha com o bloco do produto, não com a borda da tela. */}
      <div className={largura}>
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
      </div>

      {/* A chave recomeça galeria e seletor ao trocar de produto sem sair da rota. */}
      <VariantImageProvider key={product.id} initialSrc={opcaoInicial?.image ?? null}>
        <div className={`mt-4 sm:mt-5 ${colunas}`}>
          <div className="min-w-0">
            <ProductGallery images={fotos} nomeTransicao={nomeFotoProduto(product.id)} />
          </div>

          <div className="min-w-0">
            {product.brand && <p className="text-apoio text-ink-600">{product.brand}</p>}
            <h1 className="mt-1 text-balance text-titulo font-semibold text-grafite-900 sm:text-titulo-lg">
              {product.name}
            </h1>

            {/* O selo vai na linha de dados, não acima do título: selo em
                caixa alta em cima do H1 é cara de template. */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
              {selo}
              {temAvaliacao && product.rating !== undefined && (
                <Rating value={product.rating} reviewCount={product.reviewCount} size="md" />
              )}
              {product.soldCount !== undefined && product.soldCount > 0 && (
                <span className="tabular-nums">{product.soldCount} vendidos</span>
              )}
              <span>SKU {product.sku}</span>
            </div>

            {numeros.length > 0 && <NumerosDoProduto numeros={numeros} />}

            <div className="mt-5">
              <ProductPurchase product={product} productUrl={productUrl} />
            </div>

            {/* Observação real do lojista — nunca texto genérico de marketing. */}
            {product.sellerNote && (
              <p className="mt-5 flex gap-2.5 text-sm font-medium text-grafite-900">
                <Icon name="info" className="text-ouro-texto" />
                {product.sellerNote}
              </p>
            )}

            <ReputacaoDaLoja canais={[google, shopee]} />
          </div>
        </div>
      </VariantImageProvider>

      {/* Descrição, destaques, ficha técnica e envio */}
      <div className={`mt-12 sm:mt-16 ${colunas}`}>
        <div className="min-w-0 space-y-10">
          {product.description.trim() && (
            <section aria-labelledby="descricao">
              <h2 id="descricao" className={tituloDeSecao}>
                Descrição
              </h2>
              <p className="mt-3 max-w-prose whitespace-pre-line text-base leading-relaxed text-ink-600">
                {product.description}
              </p>
            </section>
          )}

          {destaques.length > 0 && (
            <section aria-labelledby="destaques">
              <h2 id="destaques" className={tituloDeSecao}>
                Destaques
              </h2>
              <ul className="mt-3 max-w-prose space-y-2.5">
                {destaques.map((destaque, i) => (
                  <li key={i} className="flex gap-3 text-base leading-relaxed text-ink-600">
                    {/* Traço de ouro no lugar de marcador ou ícone de check. */}
                    <span aria-hidden className="mt-[0.8em] h-px w-3 shrink-0 bg-ouro" />
                    {destaque}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tabela.length > 0 && (
            <section aria-labelledby="especificacoes">
              <h2 id="especificacoes" className={tituloDeSecao}>
                Especificações
              </h2>
              {/* Linhas separadas por fio, sem zebrado. */}
              <dl className="mt-3 max-w-2xl border-t border-fio">
                {tabela.map((spec, i) => (
                  <div
                    key={`${spec.label}-${i}`}
                    className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-4 border-b border-fio py-3 text-sm sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
                  >
                    <dt className="text-ink-600">{spec.label}</dt>
                    <dd className="text-grafite-900">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <section aria-labelledby="envio" className="rounded-card border border-fio bg-white p-5">
            <h2 id="envio" className="text-base font-bold text-grafite-900">
              Informações de envio
            </h2>
            <ul className="mt-3 space-y-3 text-sm text-ink-600">
              <li className="flex gap-3">
                <Icon name="localizacao" className="text-ouro-texto" />
                <span>
                  Enviado de{" "}
                  <strong className="font-semibold text-grafite-900">{product.shipping.origin}</strong>{" "}
                  para todo o Brasil.
                </span>
              </li>
              {/* Peso zerado é cadastro incompleto, não um pacote de 0 g. */}
              {product.shipping.weight > 0 && (
                <li className="flex gap-3">
                  <Icon name="caixa" className="text-ouro-texto" />
                  <span>Pacote de aproximadamente {formatWeight(product.shipping.weight)}.</span>
                </li>
              )}
              <li className="flex gap-3">
                <Icon name="conversa" className="text-ouro-texto" />
                <span>
                  O valor e o prazo do frete são confirmados com você antes de fechar o pedido.
                </span>
              </li>
              <li className="flex gap-3">
                <Icon name="troca" className="text-ouro-texto" />
                <span>
                  <Link
                    href="/institucional/trocas-e-devolucoes"
                    className="font-semibold text-grafite-900 underline decoration-ouro underline-offset-2 transition-colors duration-(--duracao-toque) hover:text-ouro-texto"
                  >
                    7 dias para arrependimento
                  </Link>
                  , conforme o Código de Defesa do Consumidor.
                </span>
              </li>
            </ul>
          </section>

          {/* Só aparece no item que veio mesmo do anúncio da Shopee. */}
          {product.sourceUrl && (
            <div className="rounded-card border border-fio bg-white p-5">
              <p className="text-sm text-ink-600">
                Este produto também está anunciado na nossa loja da Shopee, com{" "}
                {shopee.avaliacoes.toLocaleString("pt-BR")} avaliações na loja.
              </p>
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonStyles({ variant: "secundario", fullWidth: true, className: "mt-3" })}
              >
                Ver anúncio na Shopee
              </a>
            </div>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <div className="mt-16">
          {/* Sem a transição da foto aqui: a foto grande desta página "voaria"
              para um card lá embaixo quando este produto aparece nos
              relacionados do próximo. */}
          <ProductCarousel
            products={related}
            title="Produtos relacionados"
            transicaoFoto={false}
            tituloCompacto
          />
        </div>
      )}
    </div>
  );
}

/**
 * "Números do produto": até três pares da ficha em linha, número em Archivo
 * condensado e rótulo pequeno embaixo. Sem dado, a página não mostra a faixa.
 */
function NumerosDoProduto({ numeros }: { numeros: NumeroDoProduto[] }) {
  return (
    <dl className="mt-4 flex divide-x divide-fio border-y border-fio">
      {numeros.map((numero) => (
        // Coluna invertida: o <dt> vem antes no HTML (como a lista pede) e
        // aparece embaixo do número.
        <div
          key={numero.rotulo}
          className="flex min-w-0 flex-1 flex-col-reverse items-center px-2 py-2.5 text-center"
        >
          <dt className="mt-1 text-xs text-ink-600">{numero.rotulo}</dt>
          <dd className="font-price text-lg font-extrabold leading-none tabular-nums text-grafite-900 font-stretch-condensed sm:text-xl">
            {numero.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Notas da loja no Google e na Shopee: o número exato, a quantidade e o dia da
 * consulta. Sem estrelas, que aqui só enfeitariam um número que já está escrito.
 */
function ReputacaoDaLoja({ canais }: { canais: CanalReputacao[] }) {
  return (
    <section aria-labelledby="reputacao" className="mt-6">
      <h2 id="reputacao" className="text-sm font-semibold text-grafite-900">
        Reputação da loja
      </h2>
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {canais.map((canal) => (
          <li key={canal.canal}>
            <a
              href={canal.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full flex-col rounded-card border border-fio bg-white px-3 py-2.5 transition-colors duration-(--duracao-toque) hover:border-grafite-900"
            >
              <span className="text-sm text-grafite-900">
                <strong className="text-base font-bold tabular-nums">{formatNota(canal.nota)}</strong>{" "}
                {canal.preposicao} {canal.canal}
              </span>
              <span className="text-xs tabular-nums text-ink-600">
                {canal.avaliacoes.toLocaleString("pt-BR")} avaliações
              </span>
              <span className="mt-1 text-xs text-ink-500">
                Consulta pública em {formatDate(canal.consultadoEm)}
              </span>
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs leading-relaxed text-ink-500">
        Avaliações dos canais da loja; não são avaliações específicas deste produto.
      </p>
    </section>
  );
}

/**
 * A ficha do cadastro mais as medidas do pacote. Medida zerada é cadastro
 * incompleto: a linha some em vez de mostrar "0 × 0 × 0 cm" ou "0 g".
 */
function fichaComMedidas(ficha: Specification[], product: Product): Specification[] {
  const { length, width, height } = product.shipping.dimensions;
  return [
    ...ficha,
    ...(length > 0 || width > 0 || height > 0
      ? [{ label: "Dimensões", value: `${length} × ${width} × ${height} cm` }]
      : []),
    ...(product.shipping.weight > 0
      ? [{ label: "Peso", value: formatWeight(product.shipping.weight) }]
      : []),
  ];
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
