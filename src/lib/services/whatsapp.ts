import { whatsapp, type WhatsappContact } from "@/config/site";
import { resolveAttendantNumber } from "@/lib/admin/distribution";
import type { LeadKind, SellerRecord } from "@/lib/admin/types";
import type { Product } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/utils/format";
import { formatPhone, onlyDigits } from "@/lib/utils/validators";

/**
 * Lista de quem atende, como o cliente ve no dialogo do WhatsApp: cada
 * atendente cadastrado no painel vira um contato, e quem nao tem numero
 * proprio usa o numero principal da loja (editado em Configuracoes).
 *
 * Quem chama e `loadPublicAttendants()` em src/lib/catalog/database.ts, que ja
 * trata catalogo indisponivel e lista vazia caindo na lista estatica de
 * `config/site` — por isso aqui nao ha fallback: os dois argumentos sao
 * obrigatorios e a regra do numero mora num lugar so.
 */
export function contactsFor(primary: { whatsappNumber?: string; whatsappDisplay?: string }, sellers: readonly SellerRecord[]): WhatsappContact[] {
  const displayPrincipal = primary.whatsappDisplay || whatsapp.display;
  return sellers.map((seller) => ({
    id: seller.id,
    name: seller.name,
    role: seller.role_label,
    // A cascata "numero do atendente → numero da loja → constante do site" mora
    // em resolveAttendantNumber: a rota de atendimento resolve o mesmo numero
    // para o redirect, e duas copias da regra sairiam do ar uma da outra.
    number: resolveAttendantNumber(seller, primary),
    display: seller.whatsapp_display || (seller.whatsapp_number ? internationalDisplay(seller.whatsapp_number) : displayPrincipal),
  }));
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

/**
 * Rota interna que registra o atendimento e só então redireciona para o wa.me.
 *
 * Os botões do site apontam para cá em vez de irem direto ao WhatsApp: é o
 * único jeito de a loja saber que a conversa existiu, para quem foi e de qual
 * página saiu — sem isso todo contato pelo WhatsApp some do painel.
 */
export const ATENDIMENTO_ROUTE = "/api/atendimentos/whatsapp";

export interface AtendimentoLinkInput {
  /** Id do atendente escolhido pelo cliente, ou "auto" quando o painel distribui. */
  attendantId: string;
  kind: LeadKind;
  /** Texto que vai preenchido na conversa. */
  message?: string;
  /** Página de onde o cliente saiu, para o painel saber o que gerou o contato. */
  pagePath?: string;
  productId?: string;
  /** Nome informado pelo cliente. Só viaja por POST — ver `atendimentoFields`. */
  customerName?: string;
  /**
   * Pedido do checkout de onde a conversa parte (tela "Solicitação recebida").
   * Com ele a rota leva o cliente a quem já cuida do pedido, em vez de sortear
   * outra pessoa e abrir um segundo atendimento.
   */
  orderId?: string;
}

/**
 * Os campos que a rota lê, num lugar só: o link (GET) e o formulário (POST)
 * mandam exatamente os mesmos nomes.
 *
 * O formulário existe por causa do pedido rápido: ali a mensagem carrega nome,
 * bairro e observação do cliente, e numa query string de GET isso acabaria nos
 * logs de acesso do servidor, no histórico do navegador e na barra de endereço
 * da aba nova. No corpo do POST o dado fica só onde a loja precisa dele.
 */
export function atendimentoFields(input: AtendimentoLinkInput): Array<[string, string]> {
  const campos: Array<[string, string]> = [
    ["atendente", input.attendantId || "auto"],
    ["tipo", input.kind],
    ["texto", input.message ?? ""],
    ["pagina", input.pagePath ?? ""],
    ["produto", input.productId ?? ""],
    ["cliente", input.customerName ?? ""],
    ["pedido", input.orderId ?? ""],
  ];
  return campos.filter(([, valor]) => valor !== "");
}

export function atendimentoLink(input: AtendimentoLinkInput): string {
  return `${ATENDIMENTO_ROUTE}?${new URLSearchParams(atendimentoFields(input)).toString()}`;
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
