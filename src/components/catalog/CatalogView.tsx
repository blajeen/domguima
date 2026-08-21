import Link from "next/link";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { site } from "@/config/site";
import type { FilterState } from "@/lib/catalog/filters";
import type { Product, SortKey } from "@/lib/catalog/types";
import {
  CatalogFiltersProvider,
  FilterDrawer,
  FilterSidebar,
  FilterTrigger,
} from "./CatalogFilters";
import { SortSelect } from "./SortSelect";

interface CatalogViewProps {
  title: string;
  description?: string;
  breadcrumbs: Crumb[];
  products: Product[];
  brands: string[];
  filters: FilterState;
  sort: SortKey;
  hideOfferFilter?: boolean;
  /** Conteúdo extra mostrado quando não há resultado (ex.: sugestões da busca). */
  emptySlot?: React.ReactNode;
  /** Substitui o texto padrão do estado vazio. */
  emptyMessage?: string;
}

/**
 * Vitrine com filtros — compartilhada por categoria, busca, ofertas e mais
 * vendidos. Uma implementação só, para as quatro páginas se comportarem igual.
 */
export function CatalogView({
  title,
  description,
  breadcrumbs,
  products,
  brands,
  filters,
  sort,
  hideOfferFilter = false,
  emptySlot,
  emptyMessage,
}: CatalogViewProps) {
  const hasActiveFilters =
    Boolean(filters.price) ||
    filters.brands.length > 0 ||
    filters.onlyOffers ||
    filters.onlyInStock;

  return (
    <div className="site-shell py-6">
      <Breadcrumbs items={breadcrumbs} siteUrl={site.url} />

      <header className="mt-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-ink-500">{description}</p>
        )}
      </header>

      <CatalogFiltersProvider
        brands={brands}
        state={filters}
        resultCount={products.length}
        hideOfferFilter={hideOfferFilter}
      >
        <div className="mt-6 flex gap-6 lg:gap-8">
          <FilterSidebar />

          <div className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-500">
                <strong className="font-bold text-ink-900">
                  {products.length}
                </strong>{" "}
                {products.length === 1
                  ? "produto encontrado"
                  : "produtos encontrados"}
              </p>
              <div className="flex items-center gap-2">
                <FilterTrigger />
                <SortSelect value={sort} />
              </div>
            </div>

            {products.length > 0 ? (
              <ProductGrid products={products} />
            ) : (
              <div className="rounded-card border border-ink-100 bg-white px-6 py-14 text-center shadow-card">
                <p className="text-4xl" aria-hidden>
                  🔍
                </p>
                <p className="mt-4 text-lg font-bold text-ink-900">
                  {emptyMessage ?? "Nenhum produto por aqui"}
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-500">
                  {hasActiveFilters
                    ? "Tente remover algum filtro para ver mais opções."
                    : "Em breve teremos novidades nesta seção."}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link
                    href="/ofertas"
                    className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-600"
                  >
                    Ver ofertas
                  </Link>
                  <Link
                    href="/"
                    className="rounded-lg border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:border-gold-400 hover:bg-gold-50"
                  >
                    Voltar à home
                  </Link>
                </div>
                {emptySlot}
              </div>
            )}
          </div>
        </div>

        <FilterDrawer />
      </CatalogFiltersProvider>
    </div>
  );
}
