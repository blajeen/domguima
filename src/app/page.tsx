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
        {/* Títulos curtos e específicos, sem rótulo acima nem subtítulo. Sem
            `priority`: a única imagem prioritária da home é o 1º slide do banner. */}
        <ProductCarousel products={selection} title="Escolhas para começar" />

        <CategoryStrip />

        {offers.length >= 4 && (
          <ProductCarousel products={offers} title="Ofertas" href="/ofertas" />
        )}

        <ProductCarousel products={technology} title="TVs, celulares e informática" />

        <ProductCarousel products={homeEssentials} title="Para a casa" />

        <InstagramSection />
      </div>
    </>
  );
}
