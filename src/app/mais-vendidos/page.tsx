import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog/CatalogView";
import { parseFilterState, parseSort, priceRangesFor, toProductFilters } from "@/lib/catalog/filters";
import { getBestSellers, getBrands, queryProducts } from "@/lib/catalog/queries";

// Refresh time-based selections and offer periods within five minutes.
export const revalidate = 300;

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

  const matching = new Map((await queryProducts(toProductFilters(filters, sort))).filter(product => bestSellerIds.has(product.id)).map(product => [product.id, product]));
  const products = query.ordem ? [...matching.values()] : bestSellers.flatMap(product => matching.has(product.id) ? [matching.get(product.id)!] : []);

  return (
    <CatalogView
      title="Mais vendidos"
      description="Confira os destaques de vendas da Dom Guima."
      breadcrumbs={[{ label: "Início", href: "/" }, { label: "Mais vendidos" }]}
      products={products}
      brands={getBrands(bestSellers)}
      priceRanges={priceRangesFor(bestSellers)}
      filters={filters}
      sort={sort}
    />
  );
}
