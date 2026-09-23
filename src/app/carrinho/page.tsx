import type { Metadata } from "next";
import { loadParcelamento } from "@/lib/catalog/database";
import { ParcelamentoProvider } from "@/lib/store/parcelamento";
import { Carrinho } from "./Carrinho";

// Página de servidor agora pode ter metadata: título próprio e fora do índice
// (antes era client e herdava o título da home).
export const metadata: Metadata = {
  title: "Carrinho",
  robots: { index: false, follow: false },
};

/**
 * O carrinho é todo do navegador (./Carrinho.tsx); esta página só entrega a
 * tabela da maquininha do segmento, para o total não usar a do layout raiz,
 * que fica velha na navegação dentro do site.
 */
export default async function CartPage() {
  return (
    <ParcelamentoProvider value={await loadParcelamento()}>
      <Carrinho />
    </ParcelamentoProvider>
  );
}
