import { ProductCard } from "@/components/product/ProductCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Product } from "@/lib/catalog/types";

/**
 * Vitrine em grade, para variar o ritmo entre os carrosséis da home: mais
 * produtos por dobra, sem rolagem lateral. As linhas fecham cheias em cada
 * largura: 3 linhas de 2 no celular, 3 de 3 no tablet, 3 de 4 no notebook e
 * 2 de 6 no desktop (12 produtos). O que passa da conta naquela largura fica
 * escondido, e a foto dele nem é baixada (imagem lazy escondida não carrega).
 */
export function VitrineGrade({
  products,
  title,
  repetidos,
}: {
  products: Product[];
  title: string;
  /** Produtos que também aparecem em outra vitrine da tela: ficam sem a transição da foto. */
  repetidos?: ReadonlySet<string>;
}) {
  if (products.length === 0) return null;

  return (
    <section>
      <SectionHeader title={title} />
      <div className="grid grid-cols-2 gap-3 max-sm:[&>*:nth-child(n+7)]:hidden sm:grid-cols-3 sm:gap-4 sm:max-lg:[&>*:nth-child(n+10)]:hidden lg:grid-cols-4 xl:grid-cols-6">
        {products.slice(0, 12).map((product) => (
          <ProductCard key={product.id} product={product} transicaoFoto={!repetidos?.has(product.id)} />
        ))}
      </div>
    </section>
  );
}
