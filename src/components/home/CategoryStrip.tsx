import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { categoryIcon } from "@/lib/catalog/categories";
import { getCatalogCategories, getSellableProducts } from "@/lib/catalog/queries";

/**
 * Atalhos de categoria: uma lista com o ícone SVG da categoria, o nome e
 * quantos produtos ela tem, numa grade separada por fio. Sem foto de capa (a
 * home já tem foto em toda vitrine) e sem o ícone dentro de um quadrado.
 *
 * Só entram categorias com produto à venda: clicar e cair numa página vazia é
 * pior do que não ter o atalho. A contagem é a mesma lista que a página da
 * categoria mostra (só o que tem estoque).
 */
export async function CategoryStrip() {
  const [categories, products] = await Promise.all([getCatalogCategories(), getSellableProducts()]);
  const withProducts = categories
    .map((category) => ({
      category,
      count: products.filter((product) => product.categoryId === category.id).length,
    }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => a.category.order - b.category.order);

  if (withProducts.length === 0) return null;

  return (
    <section aria-labelledby="categorias-titulo">
      <SectionHeader id="categorias-titulo" title="Categorias" />
      {/* Fio à esquerda e em cima na lista, à direita e embaixo em cada item:
          as linhas não dobram de espessura entre dois itens. */}
      <ul className="grid grid-cols-2 border-l border-t border-fio sm:grid-cols-3 lg:grid-cols-5">
        {withProducts.map(({ category, count }) => (
          <li key={category.id} className="border-b border-r border-fio bg-white">
            <Link
              href={`/categoria/${category.slug}`}
              className="group flex min-h-16 items-center gap-3 px-3 py-3 focus-visible:-outline-offset-2 sm:px-4"
            >
              <Icon
                name={categoryIcon(category)}
                size={24}
                className="shrink-0 text-grafite-700 transition-colors duration-(--duracao-toque) group-hover:text-ouro-texto"
              />
              <span className="min-w-0">
                {/* Hifenização: nas duas colunas do celular, "Eletrodomésticos"
                    não cabe inteiro ao lado do ícone. */}
                <span className="block hyphens-auto break-words text-sm font-semibold leading-tight text-grafite-900 decoration-ouro underline-offset-4 group-hover:underline">
                  {category.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-500">
                  {count} {count === 1 ? "produto" : "produtos"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
