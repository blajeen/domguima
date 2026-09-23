import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { categoryIcon } from "@/lib/catalog/categories";
import type { Category } from "@/lib/catalog/types";
import { MenuMais } from "./MenuMais";

/*
 * Quantas categorias cabem na faixa, com ícone e com os nomes de hoje: 4 a
 * partir de lg, 5 a partir de xl e 7 a partir de 2xl. As que não cabem vão
 * para o "Mais", que lista exatamente as escondidas na largura atual. A faixa
 * tem altura fixa e não quebra linha: a altura entra no --header-h.
 */
function classeNaFaixa(indice: number): string | null {
  if (indice < 4) return "flex";
  if (indice < 5) return "hidden xl:flex";
  if (indice < 7) return "hidden 2xl:flex";
  return null;
}

function classeNoMais(indice: number): string | null {
  if (indice < 4) return null;
  if (indice < 5) return "flex xl:hidden";
  if (indice < 7) return "flex 2xl:hidden";
  return "flex";
}

function classeDoMais(total: number): string | null {
  if (total <= 4) return null;
  if (total <= 5) return "xl:hidden";
  if (total <= 7) return "2xl:hidden";
  return "";
}

// Link da faixa: ao passar o mouse, um sublinhado de ouro na base da faixa,
// no lugar de fundo colorido. O foco fica por dentro do link, que ocupa a
// altura toda da faixa.
const linkDaFaixa =
  "group/item flex h-full items-center gap-2 whitespace-nowrap px-3 text-sm transition-colors duration-(--duracao-toque) hover:shadow-[inset_0_-2px_0_var(--color-ouro)] focus-visible:-outline-offset-2";

/**
 * Menu de categorias do desktop: faixa branca logo abaixo da parte grafite do
 * header. "Ofertas" e "Mais vendidos" vêm primeiro e se destacam só pelo
 * texto (sem ícone de fogo ou estrela): o vermelho-oferta já diz o que é, e
 * no branco passa no contraste (5,3:1; no grafite ficaria em 3,2:1). Depois,
 * as categorias com o ícone de cada uma.
 */
export function CategoryMenu({ categories }: { categories: Category[] }) {
  const mais = classeDoMais(categories.length);

  return (
    <nav aria-label="Categorias" className="hidden h-10 border-b border-fio bg-white lg:block">
      <div className="site-shell flex h-full items-stretch">
        <ul className="flex shrink-0 items-stretch">
          <li className="flex">
            <Link href="/ofertas" className={`${linkDaFaixa} -ml-3 font-semibold text-oferta`}>
              Ofertas
            </Link>
          </li>
          <li className="flex">
            <Link href="/mais-vendidos" className={`${linkDaFaixa} font-semibold text-grafite-900`}>
              Mais vendidos
            </Link>
          </li>
        </ul>

        <span aria-hidden className="mx-2 my-3 w-px shrink-0 bg-fio" />

        {/* Corta na horizontal, e não empurra a página, se um nome cadastrado
            no painel for mais comprido que os de hoje. */}
        <ul className="flex min-w-0 flex-1 items-stretch overflow-x-clip">
          {categories.map((category, indice) => {
            const classe = classeNaFaixa(indice);
            if (!classe) return null;
            return (
              <li key={category.id} className={classe}>
                <Link
                  href={`/categoria/${category.slug}`}
                  className={`${linkDaFaixa} font-medium text-grafite-700 hover:text-grafite-900`}
                >
                  <Icon
                    name={categoryIcon(category)}
                    size={18}
                    className="text-ink-500 transition-colors duration-(--duracao-toque) group-hover/item:text-grafite-900"
                  />
                  {category.name}
                </Link>
              </li>
            );
          })}
        </ul>

        {mais !== null && (
          <MenuMais className={`shrink-0 ${mais}`}>
            {categories.map((category, indice) => {
              const classe = classeNoMais(indice);
              if (!classe) return null;
              return (
                <Link
                  key={category.id}
                  href={`/categoria/${category.slug}`}
                  className={`${classe} min-h-10 items-center gap-2.5 rounded-control px-3 text-sm font-medium text-grafite-700 transition-colors duration-(--duracao-toque) hover:bg-papel hover:text-grafite-900`}
                >
                  <Icon name={categoryIcon(category)} size={18} className="text-ink-500" />
                  {category.name}
                </Link>
              );
            })}
          </MenuMais>
        )}
      </div>
    </nav>
  );
}
