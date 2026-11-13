export const PAYMENT_STATUS_LABELS = { unconfirmed: "Não informado", pending: "A receber", paid: "Recebido", refunded: "Estornado" } as const;
export const DELIVERY_STATUS_LABELS = { unconfirmed: "Não informada", preparing: "Em preparação", ready: "Pronto para retirada", shipped: "Enviado", delivered: "Entregue", not_required: "Retirado / sem entrega" } as const;
export interface CrmWorkflowEntry {
  payment_status?: keyof typeof PAYMENT_STATUS_LABELS;
  delivery_status?: keyof typeof DELIVERY_STATUS_LABELS;
  next_contact_at?: string | null;
  last_contact_at?: string | null;
  updated_at: string;
  updated_by: string;
}
export type CrmWorkflowState = Record<string, CrmWorkflowEntry>;
export function isOverdue(date: string | null | undefined, now = new Date()): boolean {
  return Boolean(date && Number.isFinite(Date.parse(date)) && Date.parse(date) < now.getTime());
}
export function dateInShop(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
