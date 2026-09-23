import type { Metadata } from "next";
import { QuickCheckout } from "@/components/checkout/QuickCheckout";
import { loadParcelamento } from "@/lib/catalog/database";
import { ParcelamentoProvider } from "@/lib/store/parcelamento";

export const metadata: Metadata = {
  title: "Finalização rápida",
  description: "Envie seu carrinho para um vendedor da Dom Guima e combine os detalhes pelo WhatsApp.",
  robots: { index: false, follow: false },
};

// A tabela de parcelas lê a tabela da maquininha deste segmento, não a do
// layout raiz, que fica velha na navegação dentro do site.
export default async function QuickCheckoutPage() {
  return (
    <ParcelamentoProvider value={await loadParcelamento()}>
      <QuickCheckout />
    </ParcelamentoProvider>
  );
}
