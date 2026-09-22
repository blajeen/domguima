import { onlyDigits } from "@/lib/utils/validators";

/**
 * CLIENTES
 * ========
 *
 * A loja nao tem cadastro de cliente: cada pedido e cada atendimento guarda um
 * retrato de quem comprou. Para reconhecer quem VOLTA, pedidos e atendimentos
 * gravam a mesma chave (`customer_key`), calculada aqui — num lugar so, porque
 * uma regra diferente no pedido e no atendimento faria o mesmo cliente aparecer
 * como dois.
 *
 * Puro de proposito (sem I/O, sem "server-only"): roda no servidor ao gravar e
 * pode rodar no painel para agrupar. A migration 202609210003 repete a mesma
 * regra em SQL para preencher os pedidos antigos; mudar uma exige mudar a outra.
 */

/**
 * Telefone em digitos sem o DDI 55.
 *
 * O mesmo cliente aparece ora como "(34) 99999-9999" (pedido do site), ora como
 * "5534999999999" (WhatsApp). Tirar o 55 so quando sobra um numero nacional
 * completo (12 ou 13 digitos) evita cortar o DDD 55 do Rio Grande do Sul.
 */
export function phoneKey(phone: string): string {
  const digits = onlyDigits(phone);
  return digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
}

/**
 * Chave do cliente: telefone quando ha um numero com DDD, senao CPF/CNPJ.
 *
 * Telefone vem primeiro porque e o que existe nos dois lados — o atendimento
 * do WhatsApp tem telefone e nunca tem CPF. Sem nenhum dos dois (lancamento do
 * grupo, que so traz o primeiro nome) a chave e `null`: agrupar por nome
 * juntaria clientes diferentes com o mesmo "Lucas".
 */
export function customerKey(customer: { phone?: string | null; cpf?: string | null }): string | null {
  const telefone = phoneKey(customer.phone ?? "");
  if (telefone.length >= 10 && telefone.length <= 11) return telefone;
  const documento = onlyDigits(customer.cpf ?? "");
  if (documento.length === 11 || documento.length === 14) return documento;
  return null;
}
