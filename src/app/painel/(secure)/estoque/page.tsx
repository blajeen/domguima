import Link from "next/link";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { StockAdjustmentForm } from "@/components/admin/StockAdjustmentForm";
import { getAdminProducts, getInventoryMovements } from "@/lib/admin/data";
import { formatPrice } from "@/lib/utils/format";

export default async function InventoryPage() {
  const [products, movements] = await Promise.all([getAdminProducts(), getInventoryMovements()]);
  const attention = products.filter((item) => item.status !== "archived" && item.stock <= item.low_stock_threshold).sort((a, b) => a.stock - b.stock);
  return <>
    <AdminPageHeader eyebrow="Venda assistida" title="Estoque" description="O carrinho e o WhatsApp nao baixam estoque. Registre a saida quando a venda for confirmada." />
    <PanelCard><h2 className="mb-4 text-base font-black">Novo ajuste</h2><StockAdjustmentForm products={products} /></PanelCard>
    {attention.length > 0 && <PanelCard className="mt-5"><h2 className="text-base font-black">Precisam de atencao</h2><div className="mt-3 divide-y divide-ink-100">{attention.map((product) => <div key={product.id} className="flex items-center justify-between gap-4 py-3"><div><Link href={`/painel/produtos/${encodeURIComponent(product.id)}`} className="text-sm font-bold hover:text-gold-800">{product.name}</Link><p className="text-xs text-ink-400">SKU {product.sku} · limite {product.low_stock_threshold}</p></div><span className={`text-lg font-black ${product.stock === 0 ? "text-red-600" : "text-orange-600"}`}>{product.stock}</span></div>)}</div></PanelCard>}
    <PanelCard className="mt-5"><h2 className="text-base font-black">Historico de movimentacoes</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="text-xs uppercase text-ink-400"><tr><th className="py-2">Data</th><th>Produto</th><th>Movimento</th><th>Antes → Depois</th><th>Motivo</th><th>Comissão</th><th>Observacao</th></tr></thead><tbody className="divide-y divide-ink-100">{movements.map((movement) => <tr key={String(movement.id)}><td className="py-3 text-xs text-ink-500">{new Date(String(movement.created_at)).toLocaleString("pt-BR")}</td><td className="font-semibold">{(movement.products as { name?: string } | null)?.name ?? movement.product_id}</td><td className={`font-black ${Number(movement.quantity_delta) > 0 ? "text-success" : "text-red-600"}`}>{Number(movement.quantity_delta) > 0 ? "+" : ""}{movement.quantity_delta}</td><td>{movement.stock_before} → {movement.stock_after}</td><td>{reasonLabel(String(movement.reason))}</td><td>{Number(movement.commission_percent ?? 0) > 0 ? `${Number(movement.commission_percent)}% · ${formatPrice(Number(movement.commission_cents ?? 0))}` : "—"}</td><td className="text-ink-500">{movement.note || "—"}</td></tr>)}</tbody></table>{movements.length === 0 && <p className="py-8 text-center text-sm text-ink-500">Nenhuma movimentacao registrada ainda.</p>}</div></PanelCard>
  </>;
}

function reasonLabel(value: string) { return ({ initial_import: "Importacao", manual_adjustment: "Ajuste manual", sale: "Venda", cancellation: "Cancelamento", correction: "Correcao" } as Record<string, string>)[value] ?? value; }
