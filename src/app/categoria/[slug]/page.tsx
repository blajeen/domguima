import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/catalog/CatalogView";
import { parseFilterState, parseSort, toProductFilters } from "@/lib/catalog/filters";
import { getBrands, getCatalogCategories, getProductsByCategory, queryProducts } from "@/lib/catalog/queries";

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}

/** Pré-gera as rotas de categoria — todas conhecidas em tempo de build. */
export async function generateStaticParams() {
  return (await getCatalogCategories()).map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getCatalogCategories()).find((item) => item.slug === slug);
  if (!category) return { title: "Categoria não encontrada" };

  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/categoria/${category.slug}` },
    openGraph: {
      title: `${category.name} | Dom Guima`,
      description: category.description,
      url: `/categoria/${category.slug}`,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const category = (await getCatalogCategories()).find((item) => item.slug === slug);
  if (!category) notFound();

  const query = await searchParams;
  const filters = parseFilterState(query);
  const sort = parseSort(query.ordem);

  const products = await queryProducts(
    toProductFilters(filters, sort, { categoryId: category.id }),
  );
  // As marcas do filtro saem da categoria inteira, não do resultado já filtrado —
  // senão a opção some assim que o usuário a marca.
  const brands = getBrands(await getProductsByCategory(category.id));

  return (
    <CatalogView
      title={category.name}
      description={category.description}
      breadcrumbs={[
        { label: "Início", href: "/" },
        { label: category.name },
      ]}
      products={products}
      brands={brands}
      filters={filters}
      sort={sort}
    />
  );
}
