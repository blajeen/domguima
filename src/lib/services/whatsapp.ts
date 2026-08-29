import { whatsapp } from "@/config/site";
import type { Product } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/utils/format";

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
