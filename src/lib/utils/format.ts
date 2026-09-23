import { commerce } from "@/config/site";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Centavos → "R$ 129,90" */
export function formatPrice(cents: number): string {
  return brl.format(cents / 100);
}

/**
 * Partes do preço para o preço-assinatura: centavos 129990 → reais "1.299" e
 * centavos "90". Sai do mesmo formatador de `formatPrice`, então separador de
 * milhar e arredondamento são sempre os mesmos do resto do site.
 */
export function priceParts(cents: number): { reais: string; centavos: string } {
  const parts = brl.formatToParts(cents / 100);
  return {
    reais: parts
      .filter((part) => part.type === "integer" || part.type === "group")
      .map((part) => part.value)
      .join(""),
    centavos: parts.find((part) => part.type === "fraction")?.value ?? "00",
  };
}

/** Percentual de desconto inteiro (arredondado para baixo, sem inflar a oferta). */
export function discountPercent(price: number, oldPrice?: number): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.floor(((oldPrice - price) / oldPrice) * 100);
}

export interface Installment {
  count: number;
  /** centavos */
  value: number;
}

/**
 * Maior parcelamento possível respeitando a parcela mínima.
 * Retorna null quando só cabe 1x (aí não faz sentido exibir).
 */
export function bestInstallment(cents: number): Installment | null {
  for (let n = commerce.maxInstallments; n >= 2; n--) {
    const value = Math.floor(cents / n);
    if (value >= commerce.minInstallmentCents) return { count: n, value };
  }
  return null;
}

/** Preço com desconto à vista no Pix. */
export function pixPrice(cents: number): number {
  return Math.round(cents * (1 - commerce.pixDiscountPercent / 100));
}

/** As linhas de pagamento que acompanham o preço, com a mesma frase no site inteiro. */
export interface PaymentLines {
  /** Condição do preço em destaque (Pix). */
  pix: string;
  /** Parcelamento no cartão; null quando o valor não comporta parcela. */
  cartao: string | null;
}

/**
 * Mesmas regras que o card e a página de produto já usam:
 * - com parcelamento real informado pelo lojista (com taxa), o preço já é o do
 *   Pix/dinheiro e não ganha desconto extra por cima;
 * - sem ele, vale o parcelamento sem juros calculado e o desconto do Pix da
 *   configuração da loja.
 * Nenhuma condição nova: só a frase passa a ser uma só.
 */
export function paymentLines(cents: number, cardInstallment?: Installment): PaymentLines {
  if (cardInstallment) {
    return {
      pix: "no Pix ou dinheiro",
      cartao: `ou em até ${cardInstallment.count}x de ${formatPrice(cardInstallment.value)} no cartão (com taxa)`,
    };
  }

  const installment = bestInstallment(cents);
  return {
    pix:
      commerce.pixDiscountPercent > 0
        ? `${formatPrice(pixPrice(cents))} no Pix (${commerce.pixDiscountPercent}% de desconto)`
        : "à vista",
    cartao: installment
      ? `ou em até ${installment.count}x de ${formatPrice(installment.value)} no cartão (sem juros)`
      : null,
  };
}

/** O que a conta do total precisa de cada linha do carrinho. */
export interface PaymentLineItem {
  /** Centavos, por unidade. */
  price: number;
  quantity: number;
  /**
   * Parcelamento real (com taxa) do produto. `null`: o produto não tem, e vale
   * a regra do Pix com desconto. `undefined`: não se sabe (linha salva antes
   * deste campo existir), então nada é afirmado sobre o total.
   */
  cardInstallment?: Installment | null;
}

/**
 * Linhas de pagamento do TOTAL do carrinho, com a mesma frase do card e da
 * página de produto. Só afirma o que as linhas permitem afirmar:
 * - todas com parcelamento real no mesmo número de vezes: soma as parcelas
 *   informadas pelo lojista (o preço de cada uma já é o do Pix/dinheiro);
 * - todas com parcelamento real, mas em números de vezes diferentes: só a
 *   linha do Pix. O total já é o preço do Pix/dinheiro de todas, mas não há
 *   um "em até Nx" comum para somar (de propósito: não é caso de sumir tudo);
 * - nenhuma com parcelamento real: a regra de sempre aplicada ao total;
 * - mistura das duas, ou linha sem a informação: não há frase honesta para o
 *   total, e nada aparece (a loja confirma o valor pelo WhatsApp).
 */
export function totalPaymentLines(items: PaymentLineItem[]): PaymentLines | null {
  if (items.length === 0) return null;
  if (items.some((item) => item.cardInstallment === undefined)) return null;

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const reais = items.flatMap((item) => (item.cardInstallment ? [item.cardInstallment] : []));
  if (reais.length === 0) return paymentLines(total);
  if (reais.length < items.length) return null;

  const count = reais[0].count;
  if (reais.some((installment) => installment.count !== count)) {
    return { pix: "no Pix ou dinheiro", cartao: null };
  }
  const value = items.reduce(
    (sum, item) => sum + (item.cardInstallment?.value ?? 0) * item.quantity,
    0,
  );
  return paymentLines(total, { count, value });
}

/** "1.200 g" → "1,2 kg" quando fizer sentido. */
export function formatWeight(grams: number): string {
  return grams >= 1000
    ? `${(grams / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`
    : `${grams} g`;
}

/** Remove acentos e baixa a caixa — base das buscas e comparações. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** "20/08/2026" a partir de "2026-08-20" (datas de consulta de config/site e do painel). */
export function formatDate(value: string): string {
  // Meio-dia local: a data não volta um dia por causa do fuso.
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

/** Nota de avaliação com a precisão da fonte: 5 → "5,0", 4.88 → "4,88". */
export function formatNota(nota: number): string {
  return nota.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

/** "05/2022" a partir de "2022-05". */
export function formatMonthYear(value: string): string {
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}
