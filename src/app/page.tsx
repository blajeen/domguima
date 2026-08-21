import type { Metadata } from "next";
import { CategoryStrip } from "@/components/home/CategoryStrip";
import { HeroBanner } from "@/components/home/HeroBanner";
import { ExclusiveProductCarousel } from "@/components/home/ExclusiveProductCarousel";
import { InstagramSection } from "@/components/home/InstagramSection";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { TrustBar } from "@/components/home/TrustBar";
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
  const heroBanners = await getSmartBanners();
  const exclusiveProducts = await getExclusiveProducts();

  return (
    <>
      <div className="site-shell grid gap-4 py-4 lg:grid-cols-3 lg:items-stretch">
        <div className="min-w-0 lg:col-span-2">
          <HeroBanner banners={heroBanners} compact />
        </div>
        <ExclusiveProductCarousel products={exclusiveProducts} />
      </div>

      <ReviewsSection />

      <TrustBar />

      <div className="site-shell space-y-12 py-9 sm:space-y-14 sm:py-12">
        <ProductCarousel
          products={selection}
          eyebrow="Seleção Dom Guima"
          title="Escolhas para começar"
          description="Uma seleção variada do nosso catálogo para você conhecer a loja."
          priority
        />

        <CategoryStrip />

        {offers.length >= 4 && (
          <ProductCarousel
            products={offers}
            eyebrow="Preços reduzidos"
            title="Ofertas verificadas"
            description="Produtos com preço anterior informado e desconto real."
            href="/ofertas"
          />
        )}

        <ProductCarousel
          products={technology}
          eyebrow="Conecte seu mundo"
          title="Tecnologia para todos os momentos"
          description="Celulares, áudio, informática, games e acessórios."
        />

        <ProductCarousel
          products={homeEssentials}
          eyebrow="Praticidade no dia a dia"
          title="Casa confortável e bem equipada"
          description="Climatização, eletrodomésticos, ferramentas, beleza e decoração."
        />

        <InstagramSection />
      </div>
    </>
  );
}
