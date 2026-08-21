import type { Metadata } from "next";
import Link from "next/link";
import { CatalogView } from "@/components/catalog/CatalogView";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { parseFilterState, parseSort, toProductFilters } from "@/lib/catalog/filters";
import { getBestSellers, getBrands, getCatalogCategories, queryProducts, searchProducts } from "@/lib/catalog/queries";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const query = await searchParams;
  const term = typeof query.q === "string" ? query.q.trim() : "";

  return {
    title: term ? `Busca por “${term}”` : "Busca",
    description: term
      ? `Resultados para “${term}” na Dom Guima.`
      : "Busque entre os produtos da Dom Guima.",
    // Página de resultado não deve competir com as categorias no índice.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const term = typeof query.q === "string" ? query.q.trim() : "";
  const filters = parseFilterState(query);
  const sort = parseSort(query.ordem);

  if (!term) return <EmptyQuery />;

  const products = await queryProducts(toProductFilters(filters, sort, { query: term }));
  const brands = getBrands(await searchProducts(term));

  return (
    <CatalogView
      title={`Busca por “${term}”`}
      breadcrumbs={[{ label: "Início", href: "/" }, { label: `Busca: ${term}` }]}
      products={products}
      brands={brands}
      filters={filters}
      sort={sort}
      emptyMessage="Não encontramos exatamente o que você procura"
      emptySlot={<SearchSuggestions />}
    />
  );
}

/** Sugestões mostradas quando a busca não retorna nada. */
async function SearchSuggestions() {
  const [bestSellers, categories] = await Promise.all([getBestSellers(8), getCatalogCategories()]);

  return (
    <div className="mt-10 border-t border-ink-100 pt-8 text-left">
      <p className="mb-3 text-center text-sm font-semibold text-ink-700">
        Que tal procurar por uma destas categorias?
      </p>
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categoria/${category.slug}`}
            className="rounded-full border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:border-gold-400 hover:bg-gold-50 hover:text-gold-800"
          >
            <span aria-hidden className="mr-1">
              {category.icon}
            </span>
            {category.name}
          </Link>
        ))}
      </div>

      <ProductCarousel
        products={bestSellers}
        title="Enquanto isso, veja os mais vendidos"
      />
    </div>
  );
}

async function EmptyQuery() {
  const categories = await getCatalogCategories();
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="text-5xl" aria-hidden>
        🔍
      </p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink-900">
        O que você está procurando?
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        Digite na busca do topo o nome do produto, a categoria ou a marca.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categoria/${category.slug}`}
            className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:border-gold-400 hover:bg-gold-50"
          >
            <span aria-hidden className="mr-1">
              {category.icon}
            </span>
            {category.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
