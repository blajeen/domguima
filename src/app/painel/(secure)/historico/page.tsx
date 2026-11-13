import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { requireOwner } from "@/lib/admin/auth";
import { getAuditLogs } from "@/lib/admin/data";
import { auditSummary } from "@/lib/admin/audit-summary";
import { validDateParam } from "@/lib/admin/reports";
import { formatPrice } from "@/lib/utils/format";

// Toda ação gravada em audit_logs precisa de rótulo aqui: sem ele a tabela
// mostra a chave crua ("order.bulk_imported") para o dono da loja.
const labels: Record<string, string> = { "product.offer_schedule_updated": "Período da oferta atualizado", "business.target.updated": "Meta mensal atualizada", "business.campaign.updated": "Investimento em campanha atualizado", "business.costs.updated": "Custos do pedido atualizados", "order.customer_identified": "Comprador identificado", "order.workflow_updated": "Pagamento ou entrega atualizados", "lead.followup_scheduled": "Retorno agendado", "customer.contacted": "Recontato registrado", "lojistas.config.updated": "Venda para lojistas: desconto, condições ou preço do site", "lojistas.preco.updated": "Venda para lojistas: preço especial", "lojistas.preco.removed": "Venda para lojistas: preço especial tirado", "lojistas.precos.lote": "Venda para lojistas: preços especiais salvos juntos", "product.created": "Produto criado", "product.updated": "Produto atualizado", "product.archived": "Produto arquivado", "product.duplicated": "Produto duplicado", "product.deleted": "Produto excluído", "product.primary_image_changed": "Foto principal trocada", "product.image_uploaded": "Imagem adicionada", "product.images_uploaded": "Imagens adicionadas", "product.image_removed": "Imagem removida", "inventory.adjusted": "Estoque atualizado", "inventory.sheet_updated": "Planilha atualizada", "inventory.daily_sales": "Baixa avulsa", "order.received": "Pedido recebido pelo site", "order.confirmed": "Pedido confirmado", "order.completed": "Pedido finalizado", "order.cancelled": "Pedido cancelado", "order.assigned": "Pedido atribuído", "order.bulk_imported": "Pedido lançado em lote", "order.bulk_deleted": "Pedidos excluídos em lote", "lead.created": "Atendimento registrado", "lead.assigned": "Atendimento redistribuído", "lead.stage_changed": "Etapa do atendimento", "lead.linked": "Atendimento vinculado a pedido", "lead.customer_updated": "Cliente identificado no atendimento", "customer.contact_opt_out": "Cliente recusou o recontato", "customer.contact_opt_in": "Recontato permitido de novo", "category.created": "Categoria criada", "category.updated": "Categoria atualizada", "settings.updated": "Configurações atualizadas", "seller.updated": "Atendentes atualizados", "catalog.imported": "Catálogo importado" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // As linhas da venda para lojistas só aparecem para a conta principal.
  const owner = await requireOwner();
  const params = await searchParams;
  const from = validDateParam(params.de, ""), to = validDateParam(params.ate, "");
  const actor = typeof params.responsavel === "string" ? params.responsavel : "";
  const action = typeof params.acao === "string" ? params.acao : "";
  const all = await getAuditLogs(1000, { incluirLojistas: owner.principal });
  const actors = [...new Set(all.map(log => log.actor_id))].sort();
  const actions = [...new Set(all.map(log => log.action))].sort();
  const logs = all.filter(log => { const day = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(log.created_at)); return (!from || day >= from) && (!to || day <= to) && (!actor || log.actor_id === actor) && (!action || log.action === action); });
  return <><AdminPageHeader eyebrow="Rastreabilidade" title="Histórico de alterações" description="Registro das mudanças feitas no catálogo, estoque, categorias e configurações." /><PanelCard className="mb-5"><form className="flex flex-wrap items-end gap-3"><label className="text-xs font-bold">De<input name="de" type="date" defaultValue={from} className="mt-1 block rounded-lg border border-ink-200 px-3 py-2" /></label><label className="text-xs font-bold">Até<input name="ate" type="date" defaultValue={to} className="mt-1 block rounded-lg border border-ink-200 px-3 py-2" /></label><label className="text-xs font-bold">Responsável<select name="responsavel" defaultValue={actor} className="mt-1 block rounded-lg border border-ink-200 px-3 py-2"><option value="">Todos</option>{actors.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="text-xs font-bold">Ação<select name="acao" defaultValue={action} className="mt-1 block max-w-xs rounded-lg border border-ink-200 px-3 py-2"><option value="">Todas</option>{actions.map(value => <option key={value} value={value}>{labels[value] ?? value}</option>)}</select></label><button className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-bold text-white">Filtrar</button></form><p className="mt-3 text-xs text-ink-500">{logs.length} registro(s), entre as últimas {all.length} alterações disponíveis.</p></PanelCard><PanelCard><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase text-ink-400"><tr><th className="py-2">Data</th><th>Ação</th><th>Item</th><th>Detalhes</th><th>Responsável</th></tr></thead><tbody className="divide-y divide-ink-100">{logs.map((log) => <tr key={log.id}><td className="py-3 text-xs text-ink-500">{new Date(log.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td><td className="font-bold">{labels[log.action] ?? log.action}</td><td>{log.entityName}</td><td className="max-w-sm text-xs text-ink-500">{summarize(log.before_data, log.after_data, log.action)}</td><td className="text-xs text-ink-500">{log.actor_id}</td></tr>)}</tbody></table>{logs.length === 0 && <p className="py-10 text-center text-sm text-ink-500">Nenhuma alteração registrada ainda.</p>}</div></PanelCard></>;
}

function summarize(before: unknown, after: unknown, action?: string) { return action === "lojistas.precos.lote" ? resumoDoLote(before, after) : auditSummary(before, after); }

function resumoDoLote(before: unknown, after: unknown): string {
  type Item = { produto?: unknown; especialCents?: unknown };
  const lista = (dados: unknown): Item[] => Array.isArray((dados as { itens?: unknown } | null)?.itens) ? (dados as { itens: Item[] }).itens : [];
  const preco = (cents: unknown) => typeof cents === "number" ? formatPrice(cents) : "sem";
  const antes = lista(before);
  const linhas = lista(after).map((item, index) => `${String(item.produto ?? "?")}: ${preco(antes[index]?.especialCents)} → ${preco(item.especialCents)}`);
  return linhas.length > 10 ? `${linhas.slice(0, 10).join("; ")}; e mais ${linhas.length - 10}` : linhas.join("; ") || "—";
}
