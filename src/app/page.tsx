import type { Metadata } from "next";
import { CategoryStrip } from "@/components/home/CategoryStrip";
import { FaixaDeOfertas } from "@/components/home/FaixaDeOfertas";
import { HeroBanner } from "@/components/home/HeroBanner";
import {
  ExclusiveProductCarousel,
  type ProdutoExclusivo,
} from "@/components/home/ExclusiveProductCarousel";
import { InstagramSection } from "@/components/home/InstagramSection";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { TrustBar } from "@/components/home/TrustBar";
import { VitrineGrade } from "@/components/home/VitrineGrade";
import { MidiaDoTopo } from "@/components/layout/MidiaDoTopo";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { site } from "@/config/site";
import { getSmartBanners } from "@/lib/catalog/smart-banners";
import {
  getHomeCollection,
  getHomeSelection,
  getExclusiveProducts,
  getOffers,
} from "@/lib/catalog/queries";

export const metadata: Metadata = {
  title: `${site.name} — ${site.tagline}`,
  description: site.shortDescription,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const selection = await getHomeSelection(12);
  const shown = new Set(selection.map((product) => product.id));
  const technology = await getHomeCollection(
    ["smart-tvs", "celulares", "eletronicos", "informatica"],
    12,
    shown,
  );
  technology.forEach((product) => shown.add(product.id));
  const homeEssentials = await getHomeCollection(
    ["eletrodomesticos", "climatizacao", "ferramentas", "casa-decoracao", "beleza"],
    12,
    shown,
  );
  const offers = await getOffers(12);
  // As ofertas não passam pelo `shown`: um produto pode estar nelas e em outra
  // vitrine. Esse fica sem a transição da foto nas duas (nome repetido na tela
  // cancela a transição).
  const mostraOfertas = offers.length >= 4;
  const repetidos = idsRepetidos([
    selection,
    mostraOfertas ? offers : [],
    technology,
    homeEssentials,
  ]);
  const heroBanners = await getSmartBanners();
  // O carrossel é client: só vai para o navegador o que ele mostra.
  const exclusiveProducts = (await getExclusiveProducts()).map(
    (product): ProdutoExclusivo => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: product.price,
      oldPrice: product.oldPrice,
      cardInstallment: product.cardInstallment,
      image: product.images[0]
        ? { src: product.images[0].src, alt: product.images[0].alt }
        : null,
    }),
  );

  return (
    <>
      {/* O H1 fica fora do banner: os slides fora da tela ficam inert, e um H1
          dentro do 1º sumiria do leitor de tela a cada giro. */}
      <h1 className="sr-only">
        {site.name}, {site.tagline}
      </h1>
      <div
        className={`site-shell grid gap-4 py-4 ${heroBanners.length > 0 ? "lg:grid-cols-3 lg:items-stretch" : ""}`}
      >
        {heroBanners.length > 0 && (
          // Enquanto o banner passa por baixo do header, o header vira vidro.
          <MidiaDoTopo className="min-w-0 lg:col-span-2">
            <HeroBanner banners={heroBanners} />
          </MidiaDoTopo>
        )}
        <ExclusiveProductCarousel products={exclusiveProducts} />
      </div>

      {/* Cidade, CNPJ e as notas com data, numa linha, logo abaixo do topo. */}
      <TrustBar />

      {/* O ritmo varia entre as seções: cartazes de preço grande (ofertas),
          carrossel, lista de categorias, grade e carrossel de novo. Títulos
          curtos e específicos, sem rótulo acima nem subtítulo. Nenhuma foto
          daqui tem prioridade: a única da home é o 1º slide do banner. */}
      <div className="site-shell space-y-12 py-9 sm:space-y-14 sm:py-12">
        {mostraOfertas && <FaixaDeOfertas products={offers} repetidos={repetidos} />}

        {/* Um produto de cada categoria (o de maior preço com estoque), e um
            segundo das primeiras quando sobra lugar. */}
        <ProductCarousel products={selection} title="Um pouco de cada categoria" repetidos={repetidos} />

        <CategoryStrip />

        <VitrineGrade products={technology} title="TVs, celulares e informática" repetidos={repetidos} />

        <ProductCarousel products={homeEssentials} title="Para a casa" repetidos={repetidos} />

        <InstagramSection />
      </div>

      <ReviewsSection />
    </>
  );
}

/** Ids que aparecem em mais de uma das listas. */
function idsRepetidos(listas: { id: string }[][]): Set<string> {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const lista of listas) {
    for (const id of new Set(lista.map((item) => item.id))) {
      if (vistos.has(id)) repetidos.add(id);
      vistos.add(id);
    }
  }
  return repetidos;
}
