/**
 * CAMADA DE PAGAMENTO — abstração, não implementação.
 *
 * Não existe pagamento simulado neste projeto: sem gateway configurado o
 * checkout encaminha o pedido pelo WhatsApp, que é como a loja já vende hoje.
 *
 * Para plugar um gateway real (Mercado Pago, Pagar.me, Asaas, Stripe...),
 * implemente `PaymentProvider` num arquivo novo e devolva-o em
 * `getPaymentProvider()`. Nenhuma tela precisa mudar.
 */

export type PaymentMethod = "pix" | "cartao" | "boleto";

export interface PaymentIntent {
  id: string;
  method: PaymentMethod;
  /** centavos */
  amount: number;
  status: "pendente" | "pago" | "recusado" | "expirado";
  /** Pix: copia e cola. Boleto: linha digitável. Cartão: URL de 3DS. */
  payload?: string;
  expiresAt?: string;
}

export interface CreateIntentInput {
  method: PaymentMethod;
  amount: number;
  orderId: string;
  customer: { name: string; document: string; email: string; phone: string };
}

export interface PaymentProvider {
  readonly name: string;
  readonly availableMethods: PaymentMethod[];
  createIntent(input: CreateIntentInput): Promise<PaymentIntent>;
  getIntent(id: string): Promise<PaymentIntent | null>;
}

/**
 * Retorna null enquanto nenhum gateway estiver configurado. O checkout checa
 * isso e mostra o caminho por WhatsApp — em vez de fingir uma cobrança.
 */
export function getPaymentProvider(): PaymentProvider | null {
  return null;
}

export function isPaymentConfigured(): boolean {
  return getPaymentProvider() !== null;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  cartao: "Cartão de crédito",
  boleto: "Boleto bancário",
};
