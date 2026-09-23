import { whatsapp } from "@/config/site";
import { onlyDigits } from "@/lib/utils/validators";
import { attendantsFrom, sortSellers } from "./sellers";
import type { SellerRecord } from "./types";

/**
 * Quem pode receber um atendimento novo e em que numero ele cai.
 *
 * Modulo puro (sem "server-only", sem Supabase): a rota do WhatsApp, o painel e
 * os testes usam a MESMA regra. O que decide qual atendente recebe quando o
 * modo e automatico e a RPC `create_lead_v1`, porque a escolha precisa ser
 * atomica; aqui so montamos a lista de candidatos que ela recebe.
 */

/** So o que a resolucao do numero precisa de `StoreSettings`. */
export interface StoreWhatsappSource {
  whatsappNumber?: string;
}

/**
 * Numero de WhatsApp do atendente, so digitos.
 *
 * Sem numero proprio, o atendente usa o numero principal da loja (editavel em
 * Configuracoes); se nem esse estiver preenchido, cai na constante do site —
 * a mesma cascata de `contactsFor`, escrita uma vez so.
 */
export function resolveAttendantNumber(seller: Pick<SellerRecord, "whatsapp_number">, settings: StoreWhatsappSource): string {
  return onlyDigits(seller.whatsapp_number ?? "") || onlyDigits(settings.whatsappNumber ?? "") || whatsapp.number;
}

/**
 * Atendentes que entram no sorteio: ativos, com "recebe atendimentos" ligado e
 * com um numero que so leva a eles. A ordem e a configurada no painel.
 *
 * O segundo filtro e por numero REPETIDO, e nao por numero vazio: como a
 * cascata acima sempre devolve algo, quem fica sem numero proprio cai no numero
 * principal da loja — que ja e de outro atendente. Distribuir para os dois faria
 * o painel mostrar o atendimento com o segundo enquanto a conversa abriu no
 * celular do primeiro, que e exatamente o que esta tela existe para evitar.
 * Quem fica de fora continua escolhivel pelo dono na hora de transferir.
 */
export function eligibleAttendants(sellers: readonly SellerRecord[], settings: StoreWhatsappSource): SellerRecord[] {
  return semNumeroRepetido(attendantsFrom(sellers), settings);
}

/**
 * Lista que o dialogo mostra ao cliente E que a rota usa para resolver o
 * numero: os elegiveis e, quando ninguem esta marcado para receber, os ativos.
 *
 * As duas metades do site precisam da MESMA lista. Enquanto a rota olhava so
 * os elegiveis, desmarcar "recebe atendimentos" de todos fazia o dialogo
 * mostrar o numero do atendente e o redirect abrir o numero principal da loja.
 */
export function contactableAttendants(sellers: readonly SellerRecord[], settings: StoreWhatsappSource): SellerRecord[] {
  const elegiveis = eligibleAttendants(sellers, settings);
  if (elegiveis.length) return elegiveis;
  return semNumeroRepetido(sortSellers(sellers.filter((seller) => seller.active)), settings);
}

function semNumeroRepetido(lista: readonly SellerRecord[], settings: StoreWhatsappSource): SellerRecord[] {
  const numeros = new Set<string>();
  return lista.filter((seller) => {
    const numero = resolveAttendantNumber(seller, settings);
    if (!numero || numeros.has(numero)) return false;
    numeros.add(numero);
    return true;
  });
}

/** Formato que `create_lead_v1` espera em `p_candidates`. */
export function distributionCandidates(sellers: readonly SellerRecord[]): Array<{ id: string; name: string }> {
  return sellers.map((seller) => ({ id: seller.id, name: seller.name }));
}
