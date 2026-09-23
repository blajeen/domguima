/**
 * Simulação de parcelamento do painel, com as taxas da maquininha.
 *
 * São as taxas que a operadora cobra DA LOJA, as mesmas que a vitrine usa
 * (`lib/catalog/parcelamento.ts`, editáveis em Configurações). A mesma tabela
 * responde a duas perguntas diferentes, e confundi-las erra o preço cotado:
 *
 *   - Repassando ao cliente: quanto ele precisa pagar para a loja receber o
 *     valor cheio. R$ 100 em 3x (5,13%) → cliente paga R$ 105,41.
 *   - Absorvendo: quanto sobra para a loja cobrando o valor cheio.
 *     R$ 100 em 3x → a loja recebe R$ 94,87.
 *
 * Por isso a simulação mostra as duas colunas, em vez de escolher uma e
 * deixar o vendedor adivinhar qual está vendo. A coluna "repassando" é
 * exatamente o que o site mostra ao cliente.
 */
import { simularParcela, type TaxasDoCartao } from "@/lib/catalog/parcelamento";

export interface InstallmentSimulation {
  count: number;
  /** Percentual da operadora para esta quantidade de parcelas. */
  feePercent: number;
  /** Total que o cliente paga quando a taxa é repassada, em centavos. */
  customerTotalCents: number;
  /** Valor de cada parcela para o cliente, em centavos. */
  installmentCents: number;
  /** Quanto a taxa acrescenta ao preço, em centavos. */
  surchargeCents: number;
  /** Quanto a loja recebe se cobrar o valor cheio sem repassar, em centavos. */
  netCents: number;
  /** Quanto a loja perde para a operadora nesse caso, em centavos. */
  feeCents: number;
}

/**
 * Simula uma quantidade de parcelas sobre um valor. O repasse vem da mesma
 * função da vitrine: divide por (1 - taxa), não multiplica por (1 + taxa).
 * Somar 5,13% a R$ 100 daria R$ 105,13, e a loja receberia R$ 99,74 — menos
 * do que os R$ 100 que ela precisava.
 */
export function simulateInstallment(cents: number, count: number, taxas: TaxasDoCartao): InstallmentSimulation {
  const repasse = simularParcela(cents, count, taxas);
  const netCents = Math.round(cents * (1 - repasse.taxa / 100));
  return {
    count,
    feePercent: repasse.taxa,
    customerTotalCents: repasse.total,
    installmentCents: repasse.parcela,
    surchargeCents: repasse.total - cents,
    netCents,
    feeCents: cents - netCents,
  };
}

/** A tabela inteira, de 1x até a última vez configurada, para um valor. */
export function simulateAllInstallments(cents: number, taxas: TaxasDoCartao): InstallmentSimulation[] {
  return taxas.map((_, indice) => simulateInstallment(cents, indice + 1, taxas));
}
