/**
 * Taxas da maquininha, por numero de parcelas.
 *
 * Sao as taxas que a operadora cobra DA LOJA. A mesma tabela responde a duas
 * perguntas diferentes, e confundi-las erra o preco cotado:
 *
 *   - Repassando ao cliente: quanto ele precisa pagar para a loja receber o
 *     valor cheio. R$ 100 em 3x (5,13%) → cliente paga R$ 105,41.
 *   - Absorvendo: quanto sobra para a loja cobrando o valor cheio.
 *     R$ 100 em 3x → a loja recebe R$ 94,87.
 *
 * Por isso a simulacao mostra as duas colunas, em vez de escolher uma e
 * deixar o vendedor adivinhar qual esta vendo.
 */

/** Percentual cobrado pela operadora, por quantidade de parcelas. */
export const CARD_FEES: Record<number, number> = {
  1: 2.93,
  2: 4.36,
  3: 5.13,
  4: 5.89,
  5: 6.63,
  6: 7.37,
  7: 7.97,
  8: 8.69,
  9: 9.41,
  10: 10.11,
  11: 10.82,
  12: 11.51,
};

export const MAX_CARD_INSTALLMENTS = 12;

export interface InstallmentSimulation {
  count: number;
  /** Percentual da operadora para esta quantidade de parcelas. */
  feePercent: number;
  /** Total que o cliente paga quando a taxa e repassada, em centavos. */
  customerTotalCents: number;
  /** Valor de cada parcela para o cliente, em centavos. */
  installmentCents: number;
  /** Quanto a taxa acrescenta ao preco, em centavos. */
  surchargeCents: number;
  /** Quanto a loja recebe se cobrar o valor cheio sem repassar, em centavos. */
  netCents: number;
  /** Quanto a loja perde para a operadora nesse caso, em centavos. */
  feeCents: number;
}

/**
 * Simula uma quantidade de parcelas sobre um valor.
 *
 * O total repassado divide por (1 - taxa), e nao multiplica por (1 + taxa):
 * a operadora cobra o percentual sobre o valor COBRADO, nao sobre o liquido.
 * Somar 5,13% a R$ 100 daria R$ 105,13, e a loja receberia R$ 99,74 — menos
 * do que os R$ 100 que ela precisava.
 */
export function simulateInstallment(cents: number, count: number): InstallmentSimulation {
  const feePercent = CARD_FEES[count] ?? 0;
  const fator = 1 - feePercent / 100;
  const customerTotalCents = fator > 0 ? Math.round(cents / fator) : cents;
  const netCents = Math.round(cents * fator);
  return {
    count,
    feePercent,
    customerTotalCents,
    // Arredonda para cima: parcela menor que a conta deixaria a soma abaixo
    // do total, e a loja pagaria a diferenca.
    installmentCents: Math.ceil(customerTotalCents / count),
    surchargeCents: customerTotalCents - cents,
    netCents,
    feeCents: cents - netCents,
  };
}

/** A tabela inteira, de 1x ate 12x, para um valor. */
export function simulateAllInstallments(cents: number): InstallmentSimulation[] {
  return Array.from({ length: MAX_CARD_INSTALLMENTS }, (_, indice) => simulateInstallment(cents, indice + 1));
}
