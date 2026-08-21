import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { getAllProducts, getCatalogCategories } from "@/lib/catalog/queries";
import { institutionalPages } from "@/lib/content/institucional";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [categories, products] = await Promise.all([getCatalogCategories(), getAllProducts()]);

  return [
    { url: site.url, lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: `${site.url}/ofertas`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${site.url}/mais-vendidos`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...categories.map((category) => ({
      url: `${site.url}/categoria/${category.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: `${site.url}/produto/${product.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...institutionalPages.map((page) => ({
      url: `${site.url}/institucional/${page.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
}
