/**
 * Parcelamento no cartão calculado pela tabela da maquininha.
 *
 * "eu sempre coloco so o preço a vista e quando o cliente vai fechar sobe essa
 * tabela calculada ja caso seja parcelado" (dono, 23/09/2026). O lojista
 * cadastra só o preço à vista (Pix ou dinheiro); o valor de cada parcela sai
 * da taxa que a operadora cobra da loja, repassada ao cliente. Antes o
 * parcelado era digitado produto a produto, não havia campo para mudá-lo e ele
 * ficava velho quando o preço mudava.
 *
 * A conta, a mesma do simulador do painel: o valor repassado DIVIDE por
 * (1 - taxa), porque a operadora cobra o percentual sobre o valor cobrado; a
 * parcela arredonda para CIMA, e o total é parcela × vezes, o que o cliente
 * paga de fato e o que se digita na maquininha (a loja recebe pelo menos o
 * preço à vista). R$ 100 em 3x (5,13%): 3x de R$ 35,14, total R$ 105,42.
 * Taxa 0 (a loja absorve): "sem juros", parcela dividida sem acréscimo.
 *
 * Sem "server-only" e sem zod: roda no servidor (vitrine, painel, ação de
 * Configurações) e no navegador (tabela do produto, checkout, formulário).
 */
import type { Installment } from "@/lib/utils/format";

/** Taxa da operadora (%) por quantidade de parcelas; a posição 0 é 1x. */
export type TaxasDoCartao = readonly number[];

/** Tabela que o dono mandou em 23/09/2026, de 1x a 18x. */
export const TAXAS_PADRAO: TaxasDoCartao = [
  2.93, 4.36, 5.13, 5.89, 6.63, 7.37, 7.97, 8.69, 9.41, 10.11, 10.82, 11.51, 13, 14, 15, 16, 17, 18,
];

/** Até quantas vezes a tabela das Configurações aceita. */
export const MAX_PARCELAS = 24;

/**
 * Chamada padrão junto do preço: "em até 12x". É a que a lista de vendas do
 * dono usava nos 88 produtos (loja-produtos.ts); a tabela completa, até a
 * última vez, aparece na página do produto e no checkout.
 */
export const ANUNCIAR_ATE_PADRAO = 12;

/** O que a loja configurou: a tabela e até quantas vezes a chamada do preço anuncia. */
export interface ParcelamentoDaLoja {
  taxas: TaxasDoCartao;
  anunciarAte: number;
}

export const PARCELAMENTO_PADRAO: ParcelamentoDaLoja = { taxas: TAXAS_PADRAO, anunciarAte: ANUNCIAR_ATE_PADRAO };

/** Formato gravado em Configurações (`cardFeeTable`): "2.93;4.36;...". */
export function taxasParaTexto(taxas: TaxasDoCartao): string {
  return taxas.map(String).join(";");
}

/** "2,93", "2.93", "11,51%" → número; qualquer outra coisa → null. De 0 a 99,99. */
export function lerTaxaDigitada(texto: string): number | null {
  const achado = texto.trim().match(/^(\d{1,2})(?:[.,](\d{1,2}))?\s*%?$/);
  if (!achado) return null;
  return Number(`${achado[1]}.${achado[2] ?? "0"}`);
}

export type TabelaDigitada =
  | { ok: true; taxas: number[] }
  | { ok: false; vezes: number; mensagem: string };

/**
 * A mesma validação no formulário (antes de enviar) e na ação (contra form
 * adulterado): um campo por vez, preenchido em sequência a partir de 1x; o
 * primeiro vazio encerra a tabela.
 */
export function validarTabelaDigitada(valores: readonly string[]): TabelaDigitada {
  const ultimoPreenchido = valores.map((valor) => valor.trim() !== "").lastIndexOf(true);
  if (ultimoPreenchido < 0) return { ok: false, vezes: 1, mensagem: "Informe pelo menos a taxa de 1x da maquininha." };
  const taxas: number[] = [];
  for (let indice = 0; indice <= ultimoPreenchido; indice++) {
    const vezes = indice + 1;
    const valor = valores[indice] ?? "";
    if (!valor.trim()) {
      return { ok: false, vezes, mensagem: `A taxa de ${vezes}x ficou vazia, mas a de ${ultimoPreenchido + 1}x está preenchida. Preencha em sequência a partir de 1x, ou apague os campos do fim para o começo.` };
    }
    const taxa = lerTaxaDigitada(valor);
    if (taxa === null) return { ok: false, vezes, mensagem: `A taxa de ${vezes}x precisa ser um número de 0 a 99,99, como 2,93.` };
    taxas.push(taxa);
  }
  return { ok: true, taxas };
}

/**
 * Lê o que está gravado em Configurações. Tabela vazia ou inválida vale a
 * padrão: o formulário já recusa tabela errada, e uma parcela absurda no site
 * custaria mais caro do que a taxa da tabela de fábrica. A chamada fica entre
 * 2x e a última vez da tabela.
 */
export function lerParcelamento(settings: { cardFeeTable?: string | null; cardInstallmentsHeadline?: string | null } | null | undefined): ParcelamentoDaLoja {
  const digitada = validarTabelaDigitada((settings?.cardFeeTable ?? "").split(";"));
  const taxas = digitada.ok && digitada.taxas.length <= MAX_PARCELAS ? digitada.taxas : TAXAS_PADRAO;
  const pedida = Number(settings?.cardInstallmentsHeadline);
  const anunciarAte = Number.isInteger(pedida) && pedida >= 2 ? pedida : ANUNCIAR_ATE_PADRAO;
  return { taxas, anunciarAte: Math.min(anunciarAte, taxas.length) };
}

export interface Parcela {
  /** Quantidade de parcelas. */
  vezes: number;
  /** Taxa da operadora para essa quantidade, em %. 0 = sem juros. */
  taxa: number;
  /** Total que o cliente paga, em centavos. */
  total: number;
  /** Valor de cada parcela, em centavos. */
  parcela: number;
}

export function simularParcela(cents: number, vezes: number, taxas: TaxasDoCartao): Parcela {
  const taxa = taxas[vezes - 1] ?? 0;
  // Sem juros: o total é o preço, e a parcela é a divisão (a maquininha
  // acerta o centavo na última).
  if (taxa <= 0) return { vezes, taxa: 0, total: cents, parcela: Math.round(cents / vezes) };
  const repassado = Math.round(cents / (1 - taxa / 100));
  const parcela = Math.ceil(repassado / vezes);
  return { vezes, taxa, total: parcela * vezes, parcela };
}

/** A tabela inteira (1x até a última vez configurada) para um preço à vista. */
export function tabelaDeParcelas(cents: number, taxas: TaxasDoCartao): Parcela[] {
  if (cents <= 0) return [];
  return taxas.map((_, indice) => simularParcela(cents, indice + 1, taxas));
}

/**
 * A chamada junto do preço: "em até Nx de R$ X", com N = a chamada configurada
 * (limitada à tabela). Null quando a tabela só tem 1x.
 */
export function parcelamentoMaximo(cents: number, { taxas, anunciarAte }: ParcelamentoDaLoja): Installment | null {
  const vezes = Math.min(anunciarAte, taxas.length);
  if (cents <= 0 || vezes < 2) return null;
  const linha = simularParcela(cents, vezes, taxas);
  return { count: linha.vezes, value: linha.parcela, ...(linha.taxa === 0 ? { semJuros: true } : {}) };
}

/** "2,93%" */
export function formatarTaxa(taxa: number): string {
  return `${taxa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
