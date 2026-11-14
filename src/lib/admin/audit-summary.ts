const labels: Record<string, string> = { stock: "Estoque", stock_before: "Estoque antes", stock_after: "Estoque depois", price_cents: "Preço", old_price_cents: "Preço anterior", name: "Nome", status: "Status", active: "Ativo", seller: "Vendedor", seller_id: "Vendedor", seller_name: "Vendedor", totalCents: "Total", units: "Unidades", quantity: "Quantidade", commissionCents: "Comissão", priceCents: "Preço", cost_cents: "Custo", next_contact_at: "Próximo retorno", last_contact_at: "Último recontato", payment_status: "Pagamento", delivery_status: "Entrega", updated_at: "Atualizado em", updated_by: "Atualizado por" };
const valueLabels: Record<string, string> = { active: "Publicado", draft: "Rascunho", archived: "Arquivado", paid: "Recebido", pending: "Pendente", completed: "Finalizado", cancelled: "Cancelado", refunded: "Estornado", unconfirmed: "Não informado", preparing: "Em preparação", ready: "Pronto para retirada", shipped: "Enviado", delivered: "Entregue", not_required: "Retirado / sem entrega" };
function valueText(value: unknown, key: string): string {
  if (value == null || value === "") return "sem valor";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number" && /cents$/i.test(key)) return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
  if (typeof value === "string" && /_at$/.test(key) && Number.isFinite(Date.parse(value))) return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  if (Array.isArray(value)) return `${value.length} item(ns)`;
  if (typeof value === "object") return "dados atualizados";
  return (valueLabels[String(value)] ?? String(value)).slice(0, 100);
}
export function auditSummary(before: unknown, after: unknown): string {
  if (!before && !after) return "—";
  const prior = before && typeof before === "object" && !Array.isArray(before) ? before as Record<string, unknown> : {};
  const next = after && typeof after === "object" && !Array.isArray(after) ? after as Record<string, unknown> : {};
  const keys = Object.keys(next).filter(key => !["updated_at", "updated_by", "id", "product_id"].includes(key) && JSON.stringify(prior[key]) !== JSON.stringify(next[key]));
  if (!keys.length) return before ? "Sem alteração nos campos exibidos" : valueText(after, "");
  return keys.slice(0, 8).map(key => `${labels[key] ?? key.replaceAll("_", " ")}: ${key in prior ? `${valueText(prior[key], key)} → ` : ""}${valueText(next[key], key)}`).join("; ") + (keys.length > 8 ? `; e mais ${keys.length - 8} campo(s)` : "");
}
