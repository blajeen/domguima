import { CarouselRow } from "@/components/ui/CarouselRow";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Product } from "@/lib/catalog/types";
import { ProductCard } from "./ProductCard";

/**
 * Vitrine horizontal (home, produtos relacionados, busca vazia). Some sozinha
 * se não houver produto. As fotos carregam conforme a rolagem: a única imagem
 * que a home adianta é o 1º slide do banner.
 */
export function ProductCarousel({
  products,
  title,
  href,
}: {
  products: Product[];
  title: string;
  href?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section>
      <SectionHeader title={title} href={href} />
      <CarouselRow ariaLabel={title} className="product-carousel-row">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} fixedWidth />
        ))}
      </CarouselRow>
    </section>
  );
}
