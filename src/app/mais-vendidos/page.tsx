import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog/CatalogView";
import { parseFilterState, parseSort, toProductFilters } from "@/lib/catalog/filters";
import { getBestSellers, getBrands, queryProducts } from "@/lib/catalog/queries";

export const metadata: Metadata = {
  title: "Mais vendidos",
  description:
    "Os produtos que mais saem na Dom Guima: Smart TVs, eletrodomésticos, climatização, acessórios e mais.",
  alternates: { canonical: "/mais-vendidos" },
};

export default async function BestSellersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filters = parseFilterState(query);
  const sort = parseSort(query.ordem);

  const bestSellers = await getBestSellers();
  const bestSellerIds = new Set(bestSellers.map((p) => p.id));

  const products = (await queryProducts(toProductFilters(filters, sort))).filter((p) =>
    bestSellerIds.has(p.id),
  );

  return (
    <CatalogView
      title="⭐ Mais vendidos"
      description="Os produtos preferidos de quem já comprou com a gente."
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Mais vendidos" }]}
      products={products}
      brands={getBrands(bestSellers)}
      filters={filters}
      sort={sort}
    />
  );
}
