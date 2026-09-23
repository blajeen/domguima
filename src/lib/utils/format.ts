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
  /** A taxa dessa quantidade de vezes é 0: a loja absorve, e a frase diz "sem juros". */
  semJuros?: boolean;
}

/** As linhas de pagamento que acompanham o preço, com a mesma frase no site inteiro. */
export interface PaymentLines {
  /** Condição do preço em destaque (Pix). */
  pix: string;
  /** Parcelamento no cartão; null quando a tabela da maquininha só tem 1x. */
  cartao: string | null;
}

/**
 * O preço em destaque é sempre o à vista (Pix ou dinheiro): é o único que o
 * lojista cadastra. O parcelado vem da tabela da maquininha, com a taxa
 * repassada (`parcelamentoMaximo`, em lib/catalog/parcelamento). Sem
 * parcelamento, só a linha do à vista.
 */
export function paymentLines(parcelamento: Installment | null | undefined): PaymentLines {
  return {
    pix: "no Pix ou dinheiro",
    cartao: parcelamento
      ? `ou em até ${parcelamento.count}x de ${formatPrice(parcelamento.value)} no cartão (${parcelamento.semJuros ? "sem juros" : "com taxa"})`
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
