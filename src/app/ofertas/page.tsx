import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog/CatalogView";
import { parseFilterState, parseSort, toProductFilters } from "@/lib/catalog/filters";
import { getBrands, getOffers, queryProducts } from "@/lib/catalog/queries";

export const metadata: Metadata = {
  title: "Ofertas",
  description:
    "Produtos selecionados com desconto na Dom Guima. Eletrônicos, eletrodomésticos, climatização e mais com preço especial.",
  alternates: { canonical: "/ofertas" },
};

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filters = parseFilterState(query);
  const sort = parseSort(query.ordem);

  const products = await queryProducts(
    toProductFilters({ ...filters, onlyOffers: true }, sort),
  );

  return (
    <CatalogView
      title="🔥 Ofertas Dom Guima"
      description="Produtos selecionados com preços especiais. Aproveite enquanto durar o estoque."
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Ofertas" }]}
      products={products}
      brands={getBrands(await getOffers())}
      filters={filters}
      sort={sort}
      hideOfferFilter
      emptyMessage="Nenhuma oferta ativa no momento"
    />
  );
}
