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
  transicaoFoto = true,
  repetidos,
  tituloCompacto = false,
}: {
  products: Product[];
  title: string;
  href?: string;
  /**
   * A foto de cada card "voa" até a galeria ao abrir o produto. Desligue onde
   * o gesto não faz sentido (os relacionados da página de produto: a foto
   * grande da página iria voar para um card lá embaixo).
   */
  transicaoFoto?: boolean;
  /** Produtos que também aparecem em outra vitrine da mesma tela: ficam sem a transição. */
  repetidos?: ReadonlySet<string>;
  /** Título no tamanho das seções da página de produto (ver SectionHeader). */
  tituloCompacto?: boolean;
}) {
  if (products.length === 0) return null;

  return (
    <section>
      <SectionHeader title={title} href={href} compacto={tituloCompacto} />
      <CarouselRow ariaLabel={title} className="product-carousel-row">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            fixedWidth
            transicaoFoto={transicaoFoto && !repetidos?.has(product.id)}
          />
        ))}
      </CarouselRow>
    </section>
  );
}
