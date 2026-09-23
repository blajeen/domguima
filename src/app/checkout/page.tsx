import type { Metadata } from "next";
import { loadParcelamento } from "@/lib/catalog/database";
import { ParcelamentoProvider } from "@/lib/store/parcelamento";
import { Checkout } from "./Checkout";

// Página de servidor agora pode ter metadata: título próprio e fora do
// índice, como a finalização rápida (antes era client e herdava o da home).
export const metadata: Metadata = {
  title: "Finalizar pedido",
  robots: { index: false, follow: false },
};

/**
 * O checkout é todo do navegador (./Checkout.tsx); esta página só entrega a
 * tabela da maquininha do segmento. A do layout raiz não é buscada de novo na
 * navegação dentro do site e ficaria velha até o cliente recarregar a página.
 */
export default async function CheckoutPage() {
  return (
    <ParcelamentoProvider value={await loadParcelamento()}>
      <Checkout />
    </ParcelamentoProvider>
  );
}
