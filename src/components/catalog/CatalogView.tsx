import { ProductGrid } from "@/components/product/ProductGrid";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/config/site";
import type { FilterState, PriceRange } from "@/lib/catalog/filters";
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
  /**
   * Faixas do filtro de preço. Como as marcas, saem da listagem inteira e não
   * do resultado já filtrado: senão as opções mudariam a cada clique.
   */
  priceRanges: PriceRange[];
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
  priceRanges,
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
        <h1 className="text-balance text-titulo-lg font-bold text-grafite-900 sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-ink-600">{description}</p>
        )}
      </header>

      <CatalogFiltersProvider
        brands={brands}
        priceRanges={priceRanges}
        state={filters}
        resultCount={products.length}
        hideOfferFilter={hideOfferFilter}
      >
        <div className="mt-6 flex gap-6 lg:gap-8">
          <FilterSidebar />

          <div className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-600">
                <strong className="font-bold tabular-nums text-grafite-900">
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
              <div className="rounded-card border border-fio bg-white px-6 py-14 text-center">
                <Icon name="busca" size={36} className="mx-auto text-ink-400" />
                <p className="mt-4 text-lg font-bold text-grafite-900">
                  {emptyMessage ?? "Nenhum produto por aqui"}
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-600">
                  {hasActiveFilters
                    ? "Tente remover algum filtro para ver mais opções."
                    : "Esta vitrine está sem produtos no momento."}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <ButtonLink href="/ofertas">Ver ofertas</ButtonLink>
                  <ButtonLink href="/" variant="secundario">
                    Voltar à home
                  </ButtonLink>
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
