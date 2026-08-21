import { CarouselRow } from "@/components/ui/CarouselRow";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Product } from "@/lib/catalog/types";
import { ProductCard } from "./ProductCard";

/** Vitrine horizontal usada na home. Some sozinha se não houver produto. */
export function ProductCarousel({
  products,
  title,
  eyebrow,
  description,
  href,
  priority = false,
}: {
  products: Product[];
  title: string;
  eyebrow?: string;
  description?: string;
  href?: string;
  priority?: boolean;
}) {
  if (products.length === 0) return null;

  return (
    <section>
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        href={href}
      />
      <CarouselRow ariaLabel={title} className="product-carousel-row">
        {products.map((product, i) => (
          <ProductCard
            key={product.id}
            product={product}
            fixedWidth
            priority={priority && i < 3}
          />
        ))}
      </CarouselRow>
    </section>
  );
}
