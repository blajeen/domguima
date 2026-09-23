import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { categoryIcon } from "@/lib/catalog/categories";
import {
  getAllProducts,
  getCatalogCategories,
} from "@/lib/catalog/queries";

const CATEGORY_COVER_SLUGS: Record<string, string> = {
  "smart-tvs": "smart-tv-lg-full-hd-ai-43-43lr6700psa-81",
  celulares: "smartphone-motorola-signature-5g-87",
  eletrodomesticos: "micro-ondas-midea-20l-mhp20s1-44",
  climatizacao: "ar-condicionado-samsung-inverter-12-000-btus-ar12dyfaawkxaz-frio-12",
  eletronicos: "suporte-duplo-para-controle-ps5-0",
  informatica: "monitor-lg-uhd-4k-32-32ul750-w-69",
  ferramentas: "parafusadeira-vonder-12v-pfv012i-29",
  "casa-decoracao": "lixeira-tramontina-inox-5l-34",
  beleza: "secador-de-cabelo-britania-sp3100n-67",
};

/**
 * Atalhos de categoria. Só entram categorias que realmente têm produto —
 * clicar e cair numa página vazia é pior do que não ter o atalho.
 */
export async function CategoryStrip() {
  const [categories, products] = await Promise.all([getCatalogCategories(), getAllProducts()]);
  const withProducts = categories
    .map((category) => {
      const categoryProducts = products.filter((product) => product.categoryId === category.id);
      const available = categoryProducts.filter((product) => product.stock > 0 && product.images[0]);
      const preferredSlug = CATEGORY_COVER_SLUGS[category.id];
      return {
        category,
        // Conta so o disponivel: a pagina da categoria agora esconde o zerado,
        // e um atalho para pagina vazia e pior do que nao ter o atalho.
        count: available.length,
        cover: available.find((product) => product.slug === preferredSlug) ?? available.sort((a, b) => b.price - a.price)[0],
      };
    })
    .filter(({ count }) => count > 0)
    .sort((a, b) => a.category.order - b.category.order);

  if (withProducts.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Categorias" />
      <div className="grid grid-cols-3 gap-2 sm:gap-4 xl:grid-cols-5 2xl:grid-cols-6">
        {withProducts.map(({ category, count, cover }) => (
          <Link
            key={category.id}
            href={`/categoria/${category.slug}`}
            className="group overflow-hidden rounded-card border border-fio bg-white transition-colors duration-(--duracao-toque) hover:border-grafite-900"
          >
            <span className="relative block aspect-[4/3] overflow-hidden bg-white">
              {cover?.images[0] ? (
                <Image
                  src={cover.images[0].src}
                  alt=""
                  fill
                  sizes="(max-width: 639px) 46vw, (max-width: 1279px) 30vw, 19vw"
                  className="object-contain p-2 sm:p-4"
                />
              ) : (
                <span className="flex h-full items-center justify-center text-ink-400">
                  <Icon name={categoryIcon(category)} size={40} />
                </span>
              )}
            </span>
            <span className="flex min-h-[66px] items-center justify-between gap-1 border-t border-ink-50 px-2 py-2.5 text-left sm:min-h-[72px] sm:gap-2 sm:px-4 sm:py-3">
              {/* Hifenização: nas três colunas do celular, "Eletrodomésticos"
                  não cabe inteiro ao lado do contador. */}
              <span className="min-w-0 hyphens-auto break-words text-xs font-extrabold leading-tight text-ink-800 group-hover:text-gold-800 sm:text-sm">
                {category.name}
              </span>
              <span className="shrink-0 rounded-full bg-ink-50 px-1.5 py-1 text-xs font-semibold leading-none text-ink-500 sm:px-2">
                {count}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
