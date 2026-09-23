import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Category } from "@/lib/catalog/types";

/**
 * Menu horizontal do desktop. Rola lateralmente em telas médias em vez de
 * quebrar linha, mantendo o header com altura previsível.
 */
export function CategoryMenu({ categories }: { categories: Category[] }) {
  const alwaysVisible = categories.slice(0, 5);
  const wideVisible = categories.slice(5, 7);
  const moreCategories = categories.slice(5);

  return (
    <nav aria-label="Categorias" className="hidden border-b border-brand-100 bg-brand-50 lg:block">
      <div className="site-shell">
        <ul className="flex min-w-0 items-center gap-1 py-1">
          {/* Ofertas e Mais vendidos se destacam pelo texto, sem ícone de
              fogo ou estrela: o vermelho-oferta já diz o que é. */}
          <li>
            <Link
              href="/ofertas"
              className="block whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-bold text-oferta transition-colors hover:bg-oferta/5"
            >
              Ofertas
            </Link>
          </li>
          {alwaysVisible.map((category) => (
            <li key={category.id}>
              <Link
                href={`/categoria/${category.slug}`}
                className="block whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium text-brand-800 transition-colors hover:bg-brand-100 hover:text-brand-950"
              >
                {category.name}
              </Link>
            </li>
          ))}
          {wideVisible.map((category) => (
            <li key={category.id} className="hidden xl:list-item">
              <Link
                href={`/categoria/${category.slug}`}
                className="block whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium text-brand-800 transition-colors hover:bg-brand-100 hover:text-brand-950"
              >
                {category.name}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/mais-vendidos"
              className="block whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-bold text-brand-900 transition-colors hover:bg-brand-100"
            >
              Mais vendidos
            </Link>
          </li>
          {moreCategories.length > 0 && (
            <li className="relative ml-auto shrink-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-bold text-brand-900 transition-colors hover:bg-brand-100 [&::-webkit-details-marker]:hidden">
                  Mais
                  <Icon name="seta-baixo" size={14} className="transition-transform group-open:rotate-180" />
                </summary>
                <div className="absolute right-0 top-[calc(100%+0.4rem)] z-50 w-64 overflow-hidden rounded-xl border border-brand-100 bg-white p-2 shadow-xl">
                  {moreCategories.map((category, index) => (
                    <Link
                      key={category.id}
                      href={`/categoria/${category.slug}`}
                      className={`rounded-lg px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50 hover:text-brand-950 ${index < 2 ? "block xl:hidden" : "block"}`}
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              </details>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}
