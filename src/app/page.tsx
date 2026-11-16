import type { Metadata } from "next";
import { CategoryStrip } from "@/components/home/CategoryStrip";
import { ProductComparison } from "@/components/catalog/ProductComparison";
import { HeroBanner } from "@/components/home/HeroBanner";
import { InstagramSection } from "@/components/home/InstagramSection";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { TrustBar } from "@/components/home/TrustBar";
import { VitrineGrade } from "@/components/home/VitrineGrade";
import { MidiaDoTopo } from "@/components/layout/MidiaDoTopo";
import { ProductCarousel } from "@/components/product/ProductCarousel";
import { site } from "@/config/site";
import { getSmartBanners } from "@/lib/catalog/smart-banners";
import { TEMPORADAS, temporadaEm } from "@/lib/utils/temporada";
import {
  getHomeCollection,
  getHomeSelection,
  getExclusiveProducts,
  getOffers,
} from "@/lib/catalog/queries";

// Refresh time-based selections and offer periods within five minutes.
export const revalidate = 300;

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
  const comparisonProducts = [...new Map([...technology, ...homeEssentials, ...offers].map(product => [product.id, product])).values()];
  // As ofertas não passam pelo `shown`: um produto pode estar nelas e em outra
  // vitrine. Esse fica sem a transição da foto nas duas (nome repetido na tela
  // cancela a transição).
  const mostraOfertas = offers.length >= 4;
  const exclusiveProducts = await getExclusiveProducts();
  const repetidos = idsRepetidos([
    selection,
    mostraOfertas ? offers : [],
    exclusiveProducts,
    technology,
    homeEssentials,
  ]);
  const heroBanners = await getSmartBanners();
  // A home se refaz a cada 5 min (revalidate), então o título vira sozinho na data.
  const temporada = temporadaEm(new Date());

  return (
    <>
      {/* O H1 fica fora do banner: os slides fora da tela ficam inert, e um H1
          dentro do 1º sumiria do leitor de tela a cada giro. */}
      <h1 className="sr-only">
        {site.name}, {site.tagline}
      </h1>
      {heroBanners.length > 0 && (
        <div className="site-shell py-4">
          {/* Enquanto o banner passa por baixo do header, o header vira vidro. */}
          <MidiaDoTopo className="min-w-0">
            <HeroBanner banners={heroBanners} />
          </MidiaDoTopo>
        </div>
      )}

      {/* Cidade, CNPJ e as notas com data, numa linha, logo abaixo do topo. */}
      <TrustBar />

      {/* O ritmo varia entre as seções: cartazes de preço grande (ofertas),
          carrossel, lista de categorias, grade e carrossel de novo. Títulos
          curtos e específicos, sem rótulo acima nem subtítulo. Nenhuma foto
          daqui tem prioridade: a única da home é o 1º slide do banner. */}
      <div className="site-shell space-y-12 py-9 sm:space-y-14 sm:py-12">
        <CategoryStrip />

        {mostraOfertas && <VitrineGrade products={offers} title={temporada ? TEMPORADAS[temporada].titulo : "Ofertas da semana"} href="/ofertas" repetidos={repetidos} />}

        {/* Sem o selo "Só na Dom Guima" em cada card: o título da seção já diz isso. */}
        <ProductCarousel products={exclusiveProducts.map(product => ({ ...product, isExclusive: false }))} title="Exclusivos Dom Guima" repetidos={repetidos} />

        {/* Um produto de cada categoria (o de maior preço com estoque), e um
            segundo das primeiras quando sobra lugar. */}
        <ProductCarousel products={selection} title="Um pouco de cada categoria" repetidos={repetidos} />

        <ProductComparison products={comparisonProducts.map(product => ({ id: product.id, name: product.name, slug: product.slug, categoryId: product.categoryId, price: product.price, brand: product.brand ?? "", stock: product.stock, specs: product.specifications.slice(0,12) }))} />

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
