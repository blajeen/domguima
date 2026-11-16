import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { categoryIcon } from "@/lib/catalog/categories";
import { getCatalogCategories, getSellableProducts } from "@/lib/catalog/queries";

/**
 * "Compre por categoria": um bloco por categoria, com a miniatura do produto
 * mais caro com estoque (ou o ícone, sem foto), o nome e uma seta.
 *
 * Só entram categorias com produto à venda: clicar e cair numa página vazia é
 * pior do que não ter o atalho.
 */
export async function CategoryStrip() {
  const [categories, products] = await Promise.all([getCatalogCategories(), getSellableProducts()]);
  const withProducts = categories
    .map((category) => {
      const items = products.filter((product) => product.categoryId === category.id);
      const capa = items.filter((product) => product.images[0]).sort((a, b) => b.price - a.price)[0]?.images[0];
      return { category, count: items.length, capa };
    })
    .filter(({ count }) => count > 0)
    .sort((a, b) => a.category.order - b.category.order);

  if (withProducts.length === 0) return null;

  return (
    <section aria-labelledby="categorias-titulo">
      <SectionHeader id="categorias-titulo" title="Compre por categoria" />
      <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        {withProducts.map(({ category, count, capa }) => (
          <li key={category.id}>
            <Link
              href={`/categoria/${category.slug}`}
              className="group flex h-full items-center gap-3 rounded-card border border-fio bg-white p-3 transition-colors duration-(--duracao-toque) hover:border-grafite-900"
            >
              <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-control bg-[#f7f4ee]">
                {capa ? (
                  <Image src={capa.src} alt="" fill sizes="3.5rem" className="object-contain p-1" />
                ) : (
                  <Icon name={categoryIcon(category)} size={24} className="text-grafite-700" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block hyphens-auto text-sm font-semibold leading-tight text-grafite-900">
                  {category.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-500">
                  {count} {count === 1 ? "produto" : "produtos"}
                </span>
              </span>
              <span aria-hidden className="text-ink-400 transition-transform duration-(--duracao-toque) group-hover:translate-x-1 group-hover:text-grafite-900">
                ↗
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
