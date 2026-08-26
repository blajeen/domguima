import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { getAdminProducts, getInventoryMovements } from "@/lib/admin/data";
import { formatPrice } from "@/lib/utils/format";

export default async function FinancePage() {
  const [products, movements] = await Promise.all([getAdminProducts(), getInventoryMovements(1000)]);
  const prices = new Map(products.map((product) => [product.id, product.price_cents]));
  const sales = movements.filter((movement) => movement.reason === "sale" && Number(movement.quantity_delta) < 0);
  const gross = sales.reduce((sum, movement) => sum + (prices.get(movement.product_id) ?? 0) * Math.abs(Number(movement.quantity_delta)), 0);
  const commission = sales.reduce((sum, movement) => sum + Number(movement.commission_cents ?? 0), 0);
  const net = gross - commission;
  return <>
    <AdminPageHeader eyebrow="Gestão" title="Financeiro" description="Resumo das vendas registradas, comissões e valor líquido estimado." />
    <div className="grid gap-4 sm:grid-cols-3"><Metric title="Vendas registradas" value={String(sales.length)} /><Metric title="Faturamento bruto" value={formatPrice(gross)} /><Metric title="Comissões" value={formatPrice(commission)} /></div>
    <PanelCard className="mt-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-base font-black">Resumo líquido</h2><p className="mt-1 text-sm text-ink-500">Bruto menos comissões informadas nas vendas.</p></div><p className="text-2xl font-black text-success">{formatPrice(net)}</p></div></PanelCard>
    <PanelCard className="mt-5"><h2 className="text-base font-black">Vendas e comissões</h2><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase text-ink-400"><tr><th className="py-2">Data</th><th>Produto</th><th>Qtd.</th><th>Valor bruto</th><th>Comissão</th><th>Líquido</th><th>Observação</th></tr></thead><tbody className="divide-y divide-ink-100">{sales.map((movement) => { const grossSale = (prices.get(movement.product_id) ?? 0) * Math.abs(Number(movement.quantity_delta)); const commissionSale = Number(movement.commission_cents ?? 0); return <tr key={movement.id}><td className="py-3 text-xs text-ink-500">{new Date(movement.created_at).toLocaleString("pt-BR")}</td><td className="font-semibold">{movement.products?.name ?? movement.product_id}</td><td>{Math.abs(Number(movement.quantity_delta))}</td><td>{formatPrice(grossSale)}</td><td>{Number(movement.commission_percent ?? 0)}% · {formatPrice(commissionSale)}</td><td className="font-bold text-success">{formatPrice(grossSale - commissionSale)}</td><td className="text-ink-500">{movement.note || "—"}</td></tr>; })}</tbody></table>{sales.length === 0 && <p className="py-10 text-center text-sm text-ink-500">Nenhuma venda registrada ainda.</p>}</div></PanelCard>
  </>;
}

function Metric({ title, value }: { title: string; value: string }) { return <PanelCard><p className="text-xs font-bold uppercase tracking-wide text-ink-400">{title}</p><p className="mt-2 text-2xl font-black text-ink-900">{value}</p></PanelCard>; }
