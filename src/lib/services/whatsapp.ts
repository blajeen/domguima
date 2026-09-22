import { whatsapp, whatsappContacts, type WhatsappContact } from "@/config/site";
import type { SellerRecord } from "@/lib/admin/types";
import type { Product } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/utils/format";
import { formatPhone, onlyDigits } from "@/lib/utils/validators";

/**
 * Lista de quem atende, como o cliente ve no dialogo do WhatsApp.
 *
 * Com `sellers` (os atendentes cadastrados no painel) cada um vira um contato:
 * quem nao tem numero proprio usa o numero principal da loja, que o painel ja
 * edita em Configuracoes. Sem `sellers` — catalogo indisponivel — cai na lista
 * estatica de `config/site`, onde so o numero do dono (primeiro) segue o painel.
 */
export function contactsFor(primary?: { whatsappNumber?: string; whatsappDisplay?: string }, sellers?: readonly SellerRecord[]): WhatsappContact[] {
  if (sellers) {
    const numeroPrincipal = onlyDigits(primary?.whatsappNumber ?? "") || whatsapp.number;
    const displayPrincipal = primary?.whatsappDisplay || whatsapp.display;
    return sellers.map((seller) => ({
      id: seller.id,
      name: seller.name,
      role: seller.role_label,
      number: seller.whatsapp_number ?? numeroPrincipal,
      display: seller.whatsapp_display || (seller.whatsapp_number ? internationalDisplay(seller.whatsapp_number) : displayPrincipal),
    }));
  }
  return whatsappContacts.map((contact, index) => {
    if (index !== 0 || !primary?.whatsappNumber) return contact;
    return { ...contact, number: primary.whatsappNumber, display: primary.whatsappDisplay || contact.display };
  });
}

/** "5534998648425" → "(34) 99864-8425"; numero fora do padrao brasileiro volta como esta. */
function internationalDisplay(number: string): string {
  const digits = onlyDigits(number);
  const nacional = digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
  return nacional.length === 10 || nacional.length === 11 ? formatPhone(nacional) : digits;
}

/** Monta o link wa.me com a mensagem já preenchida. */
export function whatsappLink(message?: string, number = whatsapp.number): string {
  const base = `https://wa.me/${number.replace(/\D/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Link para iniciar a conversa com um cliente usando o DDD brasileiro informado. */
export function customerWhatsappLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits : `55${digits}`;
  return whatsappLink(message, number);
}

export function productMessage(product: Product, url?: string): string {
  const lines = [
    `Olá! Tenho interesse no produto *${product.name}*.`,
    `Preço no site: ${formatPrice(product.price)}`,
  ];
  if (url) lines.push(url);
  lines.push("Pode me ajudar?");
  return lines.join("\n");
}

export interface CartLine {
  name: string;
  quantity: number;
  /** centavos */
  price: number;
}

export function cartMessage(lines: CartLine[], total: number): string {
  const items = lines
    .map((l) => `• ${l.quantity}x ${l.name} — ${formatPrice(l.price * l.quantity)}`)
    .join("\n");
  return [
    "Olá! Quero finalizar este pedido pela Dom Guima:",
    "",
    items,
    "",
    `*Total: ${formatPrice(total)}*`,
  ].join("\n");
}

export interface QuickOrderDetails {
  name: string;
  delivery: string;
  neighborhood?: string;
  notes?: string;
}

export function quickCartMessage(lines: CartLine[], total: number, details: QuickOrderDetails): string {
  const items = lines
    .map((line) => `• ${line.quantity}x ${line.name} — ${formatPrice(line.price * line.quantity)}`)
    .join("\n");
  return [
    "*PEDIDO RÁPIDO — SITE DOM GUIMA*",
    "",
    `Cliente: ${details.name}`,
    `Recebimento: ${details.delivery}`,
    details.neighborhood ? `Bairro: ${details.neighborhood}` : "",
    "",
    "*Itens*",
    items,
    "",
    `*Total dos produtos: ${formatPrice(total)}*`,
    details.notes ? `Observação: ${details.notes}` : "",
    "",
    "Aguardo a confirmação da disponibilidade, entrega e forma de pagamento.",
  ].filter(Boolean).join("\n");
}

export const genericMessage = "Olá! Vim pelo site da Dom Guima e preciso de ajuda.";
