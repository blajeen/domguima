import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { getAuditLogs } from "@/lib/admin/data";

const labels: Record<string, string> = { "product.created": "Produto criado", "product.updated": "Produto atualizado", "product.archived": "Produto arquivado", "product.image_uploaded": "Imagem adicionada", "product.images_uploaded": "Imagens adicionadas", "product.image_removed": "Imagem removida", "inventory.adjusted": "Estoque atualizado", "inventory.sheet_updated": "Planilha atualizada", "inventory.daily_sales": "Baixa avulsa", "order.completed": "Pedido finalizado", "order.cancelled": "Pedido cancelado", "category.created": "Categoria criada", "category.updated": "Categoria atualizada", "settings.updated": "Configurações atualizadas", "catalog.imported": "Catálogo importado" };

export default async function HistoryPage() {
  const logs = await getAuditLogs();
  return <><AdminPageHeader eyebrow="Rastreabilidade" title="Histórico de alterações" description="Registro das mudanças feitas no catálogo, estoque, categorias e configurações." /><PanelCard><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase text-ink-400"><tr><th className="py-2">Data</th><th>Ação</th><th>Item</th><th>Detalhes</th><th>Responsável</th></tr></thead><tbody className="divide-y divide-ink-100">{logs.map((log) => <tr key={log.id}><td className="py-3 text-xs text-ink-500">{new Date(log.created_at).toLocaleString("pt-BR")}</td><td className="font-bold">{labels[log.action] ?? log.action}</td><td>{log.entityName}</td><td className="max-w-sm text-xs text-ink-500">{summarize(log.before_data, log.after_data)}</td><td className="text-xs text-ink-500">{log.actor_id}</td></tr>)}</tbody></table>{logs.length === 0 && <p className="py-10 text-center text-sm text-ink-500">Nenhuma alteração registrada ainda.</p>}</div></PanelCard></>;
}

function summarize(before: unknown, after: unknown) { if (!before && !after) return "—"; const text = JSON.stringify(after ?? before); return text.length > 180 ? `${text.slice(0, 180)}…` : text; }
