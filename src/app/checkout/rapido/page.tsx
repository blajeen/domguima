import type { Metadata } from "next";
import { QuickCheckout } from "@/components/checkout/QuickCheckout";

export const metadata: Metadata = {
  title: "Finalização rápida",
  description: "Envie seu carrinho para um vendedor da Dom Guima e combine os detalhes pelo WhatsApp.",
  robots: { index: false, follow: false },
};

export default function QuickCheckoutPage() {
  return <QuickCheckout />;
}
