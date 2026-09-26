import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { requireOwner } from "@/lib/admin/auth";
import { getAuditLogs } from "@/lib/admin/data";
import { formatPrice } from "@/lib/utils/format";

// Toda ação gravada em audit_logs precisa de rótulo aqui: sem ele a tabela
// mostra a chave crua ("order.bulk_imported") para o dono da loja.
const labels: Record<string, string> = { "lojistas.config.updated": "Venda para lojistas: desconto, condições ou preço do site", "lojistas.preco.updated": "Venda para lojistas: preço especial", "lojistas.preco.removed": "Venda para lojistas: preço especial tirado", "lojistas.precos.lote": "Venda para lojistas: preços especiais salvos juntos", "product.created": "Produto criado", "product.updated": "Produto atualizado", "product.archived": "Produto arquivado", "product.duplicated": "Produto duplicado", "product.deleted": "Produto excluído", "product.primary_image_changed": "Foto principal trocada", "product.image_uploaded": "Imagem adicionada", "product.images_uploaded": "Imagens adicionadas", "product.image_removed": "Imagem removida", "inventory.adjusted": "Estoque atualizado", "inventory.sheet_updated": "Planilha atualizada", "inventory.daily_sales": "Baixa avulsa", "order.received": "Pedido recebido pelo site", "order.confirmed": "Pedido confirmado", "order.completed": "Pedido finalizado", "order.cancelled": "Pedido cancelado", "order.assigned": "Pedido atribuído", "order.bulk_imported": "Pedido lançado em lote", "order.bulk_deleted": "Pedidos excluídos em lote", "lead.created": "Atendimento registrado", "lead.assigned": "Atendimento redistribuído", "lead.stage_changed": "Etapa do atendimento", "lead.linked": "Atendimento vinculado a pedido", "lead.customer_updated": "Cliente identificado no atendimento", "customer.contact_opt_out": "Cliente recusou o recontato", "customer.contact_opt_in": "Recontato permitido de novo", "category.created": "Categoria criada", "category.updated": "Categoria atualizada", "settings.updated": "Configurações atualizadas", "seller.updated": "Atendentes atualizados", "catalog.imported": "Catálogo importado" };

export default async function HistoryPage() {
  // As linhas da venda para lojistas só aparecem para a conta principal.
  const owner = await requireOwner();
  const logs = await getAuditLogs(100, { incluirLojistas: owner.principal });
  return <><AdminPageHeader eyebrow="Rastreabilidade" title="Histórico de alterações" description="Registro das mudanças feitas no catálogo, estoque, categorias e configurações." /><PanelCard><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase text-ink-400"><tr><th className="py-2">Data</th><th>Ação</th><th>Item</th><th>Detalhes</th><th>Responsável</th></tr></thead><tbody className="divide-y divide-ink-100">{logs.map((log) => <tr key={log.id}><td className="py-3 text-xs text-ink-500">{new Date(log.created_at).toLocaleString("pt-BR")}</td><td className="font-bold">{labels[log.action] ?? log.action}</td><td>{log.entityName}</td><td className="max-w-sm text-xs text-ink-500">{summarize(log.before_data, log.after_data, log.action)}</td><td className="text-xs text-ink-500">{log.actor_id}</td></tr>)}</tbody></table>{logs.length === 0 && <p className="py-10 text-center text-sm text-ink-500">Nenhuma alteração registrada ainda.</p>}</div></PanelCard></>;
}

function summarize(before: unknown, after: unknown, action?: string) { if (action === "lojistas.precos.lote") return resumoDoLote(before, after); if (!before && !after) return "—"; const text = JSON.stringify(after ?? before); return text.length > 180 ? `${text.slice(0, 180)}…` : text; }

/** "Salvar todos" da venda para lojistas: cada item com o preço antes e depois ("sem" = sem preço especial). */
function resumoDoLote(before: unknown, after: unknown): string {
  type Item = { produto?: unknown; especialCents?: unknown };
  const lista = (dados: unknown): Item[] => (Array.isArray((dados as { itens?: unknown } | null)?.itens) ? (dados as { itens: Item[] }).itens : []);
  const preco = (cents: unknown) => (typeof cents === "number" ? formatPrice(cents) : "sem");
  const antes = lista(before);
  const linhas = lista(after).map((item, i) => `${String(item.produto ?? "?")}: ${preco(antes[i]?.especialCents)} → ${preco(item.especialCents)}`);
  return linhas.length > 10 ? `${linhas.slice(0, 10).join("; ")}; e mais ${linhas.length - 10}` : linhas.join("; ") || "—";
}
