import type { Category } from "./types";

/**
 * Categorias derivadas do que a loja realmente vende — a partir de 20/08/2026,
 * seguem a própria organização da lista de vendas do lojista (WhatsApp), que é
 * mais completa que a descrição pública da Shopee/Instagram.
 *
 * Mantemos poucas e reais. Para adicionar outra, basta um objeto novo aqui —
 * menu, home, rotas, sitemap e filtros leem desta lista.
 */
export const categories: Category[] = [
  {
    id: "smart-tvs",
    name: "Smart TVs",
    slug: "smart-tvs",
    description:
      "Smart TVs HD, Full HD e 4K de Samsung, LG e Toshiba, além de soundbars para completar a sala.",
    icon: "📺",
    order: 1,
    inMainMenu: true,
  },
  {
    id: "celulares",
    name: "Celulares e Acessórios",
    slug: "celulares-e-acessorios",
    description: "Smartphones e acessórios para levar no dia a dia e no esporte.",
    icon: "📱",
    order: 2,
    inMainMenu: true,
  },
  {
    id: "eletrodomesticos",
    name: "Eletrodomésticos",
    slug: "eletrodomesticos",
    description:
      "Air fryers, liquidificadores, ferros de passar, micro-ondas e máquinas de lavar.",
    icon: "🔌",
    order: 3,
    inMainMenu: true,
  },
  {
    id: "climatizacao",
    name: "Climatização",
    slug: "climatizacao",
    description:
      "Ar-condicionados, ventiladores, climatizadores e aquecedores para qualquer época do ano.",
    icon: "❄️",
    order: 4,
    inMainMenu: true,
  },
  {
    id: "eletronicos",
    name: "Eletrônicos",
    slug: "eletronicos",
    description: "Caixas de som e acessórios para Starlink e videogame.",
    icon: "🎧",
    order: 5,
    inMainMenu: true,
  },
  {
    id: "informatica",
    name: "Informática e Games",
    slug: "informatica",
    description:
      "Monitores, periféricos, cadeiras gamer e acessórios para computador e setup.",
    icon: "💻",
    order: 6,
    inMainMenu: true,
  },
  {
    id: "ferramentas",
    name: "Ferramentas",
    slug: "ferramentas",
    description:
      "Parafusadeiras, esmerilhadeiras, fechaduras digitais e kits de ferramentas.",
    icon: "🔧",
    order: 7,
    inMainMenu: true,
  },
  {
    id: "casa-decoracao",
    name: "Casa e Decoração",
    slug: "casa-e-decoracao",
    description: "Utilidades domésticas e itens para deixar a casa com a sua cara.",
    icon: "🏠",
    order: 8,
    inMainMenu: true,
  },
  {
    id: "beleza",
    name: "Beleza",
    slug: "beleza",
    description: "Chapinhas e secadores para o cuidado do dia a dia.",
    icon: "💇",
    order: 9,
    inMainMenu: true,
  },
];

export const categoryById = new Map(categories.map((c) => [c.id, c]));
export const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

export function getCategory(slug: string): Category | undefined {
  return categoryBySlug.get(slug);
}

export const mainMenuCategories = categories
  .filter((c) => c.inMainMenu)
  .sort((a, b) => a.order - b.order);
