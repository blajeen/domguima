import { commerce } from "@/config/site";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Centavos → "R$ 129,90" */
export function formatPrice(cents: number): string {
  return brl.format(cents / 100);
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
