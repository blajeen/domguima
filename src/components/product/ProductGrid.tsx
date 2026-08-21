import type { Product } from "@/lib/catalog/types";
import { ProductCard } from "./ProductCard";

/** Grade responsiva: 2 colunas no celular e até 6 em desktop amplo. */
export function ProductGrid({
  products,
  priorityCount = 4,
}: {
  products: Product[];
  /** Quantos cards carregam a imagem com prioridade (acima da dobra). */
  priorityCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {products.map((product, i) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={i < priorityCount}
        />
      ))}
    </div>
  );
}
