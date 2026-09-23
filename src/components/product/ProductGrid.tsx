import type { Product } from "@/lib/catalog/types";
import { ProductCard } from "./ProductCard";

/**
 * Grade responsiva: 2 colunas no celular e até 6 em desktop amplo. O vão é o
 * mesmo dos carrosséis (gap-3, gap-4 a partir de sm). Cada produto aparece uma
 * vez só na grade, então todas as fotos levam a transição até a página dele.
 */
export function ProductGrid({
  products,
  eagerCount = 4,
}: {
  products: Product[];
  /** Quantos cards baixam a foto sem esperar a rolagem (acima da dobra). */
  eagerCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} eager={i < eagerCount} transicaoFoto />
      ))}
    </div>
  );
}
