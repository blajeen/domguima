import type { Banner } from "./types";

/** Banners editoriais. A home resolve uma foto real de cada categoria. */
export const banners: Banner[] = [
  {
    id: "casa",
    eyebrow: "Variedade para o seu dia a dia",
    title: "Tecnologia e praticidade para toda a casa",
    subtitle: "Produtos reais do catálogo Dom Guima, com atendimento direto e envio para todo o Brasil.",
    ctaLabel: "Explorar produtos",
    href: "/categoria/eletrodomesticos",
    theme: "gold",
    categoryId: "eletrodomesticos",
  },
  {
    id: "tecnologia",
    eyebrow: "Conecte seu mundo",
    title: "Tecnologia para trabalhar, jogar e aproveitar",
    subtitle: "Celulares, informática, games, áudio e acessórios selecionados em um só lugar.",
    ctaLabel: "Ver tecnologia",
    href: "/categoria/informatica",
    theme: "ink",
    categoryId: "celulares",
  },
  {
    id: "climatizacao",
    eyebrow: "Conforto em todas as estações",
    title: "Sua casa na temperatura certa",
    subtitle: "Ar-condicionados, climatizadores e ventiladores para cada ambiente.",
    ctaLabel: "Ver climatização",
    href: "/categoria/climatizacao",
    theme: "deep",
    categoryId: "climatizacao",
  },
];
