import { onlyDigits } from "@/lib/utils/validators";
import { normalize } from "@/lib/utils/format";
import type { LeadDistributionMode, SellerRecord } from "./types";

/**
 * Regras puras sobre atendentes (sem Supabase, sem "server-only"): o que e um
 * atendente valido, quais sao os padrao e como um registro antigo do JSONB vira
 * um registro completo. Usado pela leitura do catalogo, pela action que salva a
 * lista e pela vitrine.
 */

/** Id que o painel usava para o dono antes de o site e o painel falarem a mesma lingua. */
export const LEGACY_OWNER_SELLER_ID = "dom-guima";
/** Id canonico do dono — o mesmo que o site sempre usou em whatsappContacts. */
export const OWNER_SELLER_ID = "juliano";

export const SELLER_ID_PATTERN = /^[a-z0-9-]{2,40}$/;

/**
 * Os dois atendentes atuais. Os numeros batem com `whatsappContacts` de
 * src/config/site.ts: o dono usa o numero principal da loja (por isso `null`),
 * o vendedor tem numero proprio informado pelo lojista em 11/09/2026.
 */
export function defaultSellers(): SellerRecord[] {
  return [
    { id: OWNER_SELLER_ID, name: "Juliano", role_label: "Dono da loja", whatsapp_number: null, whatsapp_display: "", receives_leads: true, active: true, sort_order: 0 },
    { id: "gabriel", name: "Gabriel", role_label: "Vendedor", whatsapp_number: "5534998648425", whatsapp_display: "(34) 99864-8425", receives_leads: true, active: true, sort_order: 1 },
  ];
}

/** Troca o id antigo do dono pelo canonico; qualquer outro id volta igual. */
export function canonicalSellerId(id: string): string {
  return id === LEGACY_OWNER_SELLER_ID ? OWNER_SELLER_ID : id;
}

/**
 * Completa um registro vindo do JSONB (ou de uma versao anterior do app) com
 * os campos novos.
 *
 * Campo AUSENTE (registro antigo) herda o valor do atendente padrao de mesmo
 * id — e assim que "gabriel" gravado como {id, name, active} ganha o numero
 * dele sem ninguem precisar recadastrar. Campo presente, mesmo vazio, e
 * respeitado: `whatsapp_number: null` e uma escolha ("usa o numero da loja").
 */
export function normalizeSeller(value: Partial<SellerRecord> | null | undefined, index = 0): SellerRecord {
  const idBruto = typeof value?.id === "string" ? value.id.trim() : "";
  const legado = idBruto === LEGACY_OWNER_SELLER_ID;
  const id = canonicalSellerId(idBruto);
  const padrao = defaultSellers().find((seller) => seller.id === id);

  const nomeGravado = typeof value?.name === "string" ? value.name.trim() : "";
  // O dono antigo se chamava "Dom Guima" no painel; no site sempre foi Juliano.
  const name = legado && (!nomeGravado || nomeGravado === "Dom Guima") ? "Juliano" : nomeGravado || padrao?.name || id;

  const numeroInformado = value?.whatsapp_number;
  const whatsapp_number = numeroInformado === undefined
    ? padrao?.whatsapp_number ?? null
    : typeof numeroInformado === "string" && onlyDigits(numeroInformado) ? onlyDigits(numeroInformado) : null;

  return {
    id,
    name,
    role_label: typeof value?.role_label === "string" && value.role_label.trim() ? value.role_label.trim() : padrao?.role_label ?? "Vendedor",
    whatsapp_number,
    whatsapp_display: typeof value?.whatsapp_display === "string" ? value.whatsapp_display.trim() : padrao?.whatsapp_display ?? "",
    receives_leads: typeof value?.receives_leads === "boolean" ? value.receives_leads : true,
    active: typeof value?.active === "boolean" ? value.active : true,
    sort_order: typeof value?.sort_order === "number" && Number.isFinite(value.sort_order) ? value.sort_order : index,
  };
}

/**
 * Normaliza a lista inteira: mapeia ids antigos, remove duplicatas (o primeiro
 * vence) e devolve os padrao quando nao sobra nada — o painel precisa de pelo
 * menos um vendedor para confirmar pedidos.
 */
export function normalizeSellers(value: unknown): SellerRecord[] {
  if (!Array.isArray(value)) return defaultSellers();
  const vistos = new Set<string>();
  const lista: SellerRecord[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const seller = normalizeSeller(item as Partial<SellerRecord>, index);
    if (!seller.id || vistos.has(seller.id)) return;
    vistos.add(seller.id);
    lista.push(seller);
  });
  return lista.length ? lista : defaultSellers();
}

export function sortSellers(sellers: readonly SellerRecord[]): SellerRecord[] {
  return [...sellers].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pt-BR"));
}

/** Ativos que aparecem para o cliente e entram na distribuicao, na ordem configurada. */
export function attendantsFrom(sellers: readonly SellerRecord[]): SellerRecord[] {
  return sortSellers(sellers.filter((seller) => seller.active && seller.receives_leads));
}

/** Id de atendente a partir do nome: "José Carlos" → "jose-carlos". */
export function sellerIdFromName(name: string): string {
  return normalize(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export function normalizeLeadDistributionMode(value: unknown): LeadDistributionMode {
  return value === "round_robin" || value === "least_busy" ? value : "customer_choice";
}
