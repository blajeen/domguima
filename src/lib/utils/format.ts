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

/** "05/2022" a partir de "2022-05". */
export function formatMonthYear(value: string): string {
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}
