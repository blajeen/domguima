import Link from "next/link";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { requireOwner } from "@/lib/admin/auth";
import { readCatalogState } from "@/lib/admin/catalog-store";
import { defaultReportRange, reportOrders, reportTotals, sellerSummaries, validDateParam } from "@/lib/admin/reports";
import { formatPrice } from "@/lib/utils/format";

type Params = Record<string, string | string[] | undefined>;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOwner();
  const params = await searchParams;
  const state = await readCatalogState();
  const fallback = defaultReportRange();
  const from = validDateParam(params.de, fallback.from);
  const to = validDateParam(params.ate, fallback.to);
  const sellerId = typeof params.vendedor === "string" ? params.vendedor : "";
  const status = params.status === "cancelled" ? "cancelled" : params.status === "all" ? "all" : "completed";
  const orders = reportOrders(state, { from, to, sellerId, status });
  const totals = reportTotals(orders);
  const sellers = sellerSummaries(orders);
  const downloadParams = new URLSearchParams({ de: from, ate: to, status });
  if (sellerId) downloadParams.set("vendedor", sellerId);

  return <>
    <AdminPageHeader eyebrow="Fechamento comercial" title="Relatórios e comissões" description="Selecione um período para conferir pedidos, produtos vendidos, faturamento, descontos e comissão por vendedor." actions={<Link href={`/api/painel/relatorio?${downloadParams}`} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-green-600">↓ Baixar Excel (CSV)</Link>} />
    <PanelCard>
      <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[170px_170px_200px_180px_auto] xl:items-end">
        <label className="text-xs font-bold text-ink-600">Data inicial<input type="date" name="de" defaultValue={from} className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm" /></label>
        <label className="text-xs font-bold text-ink-600">Data final<input type="date" name="ate" defaultValue={to} className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm" /></label>
        <label className="text-xs font-bold text-ink-600">Vendedor<select name="vendedor" defaultValue={sellerId} className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"><option value="">Todos os vendedores</option>{state.operations.sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label>
        <label className="text-xs font-bold text-ink-600">Status<select name="status" defaultValue={status} className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"><option value="completed">Somente finalizados</option><option value="cancelled">Somente cancelados</option><option value="all">Todos</option></select></label>
        <button className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-bold text-white">Atualizar relatório</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2 text-xs"><RangeLink label="Este mês" from={fallback.from} to={fallback.to} /><RangeLink label="Mês anterior" {...previousMonthRange()} /></div>
    </PanelCard>

    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <Metric title="Pedidos" value={String(totals.orders)} />
      <Metric title="Produtos vendidos" value={String(totals.units)} />
      <Metric title="Valor bruto" value={formatPrice(totals.grossCents)} />
      <Metric title="Descontos" value={formatPrice(totals.discountCents)} />
      <Metric title="Vendas líquidas" value={formatPrice(totals.salesCents)} tone="green" />
      <Metric title="Comissões" value={formatPrice(totals.commissionCents)} tone="gold" />
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <PanelCard><div className="flex items-end justify-between gap-3"><div><h2 className="text-base font-black">Resultado por vendedor</h2><p className="mt-1 text-xs text-ink-500">Somente pedidos finalizados entram nos totais.</p></div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs uppercase text-ink-400"><tr><th className="py-2">Vendedor</th><th>Pedidos</th><th>Produtos</th><th>Vendas</th><th>Comissão</th></tr></thead><tbody className="divide-y divide-ink-100">{sellers.map((seller) => <tr key={seller.sellerId}><td className="py-3 font-bold">{seller.sellerName}</td><td>{seller.orders}</td><td>{seller.units}</td><td>{formatPrice(seller.salesCents)}</td><td className="font-black text-gold-800">{formatPrice(seller.commissionCents)}</td></tr>)}</tbody></table>{!sellers.length && <p className="py-10 text-center text-sm text-ink-500">Nenhuma venda finalizada neste período.</p>}</div></PanelCard>
      <PanelCard><h2 className="text-base font-black">Regra de comissão</h2><p className="mt-1 text-xs leading-relaxed text-ink-500">Calculada por unidade sobre o preço final vendido, depois do desconto.</p><div className="mt-4 space-y-3 text-sm"><Rule label="Até R$ 25,00" value="R$ 1,00" /><Rule label="R$ 25,01 a R$ 100,00" value="R$ 2,50" /><Rule label="R$ 100,01 a R$ 250,00" value="R$ 5,00" /><Rule label="R$ 250,01 a R$ 1.000,00" value="R$ 10,00" /><Rule label="Acima de R$ 1.000,00" value="1%" /></div></PanelCard>
    </div>

    <PanelCard className="mt-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-base font-black">Pedidos do período</h2><p className="mt-1 text-xs text-ink-500">{from.split("-").reverse().join("/")} a {to.split("-").reverse().join("/")}</p></div><span className="text-xs text-ink-400">{totals.cancelled} cancelado(s) na seleção</span></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase text-ink-400"><tr><th className="py-2">Data</th><th>Pedido</th><th>Cliente</th><th>Vendedor</th><th>Itens</th><th>Desconto</th><th>Total</th><th>Comissão</th><th>Status</th></tr></thead><tbody className="divide-y divide-ink-100">{orders.map((order) => <tr key={order.id}><td className="py-3 text-xs text-ink-500">{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(order.created_at))}</td><td className="font-black">{order.number}</td><td>{order.customer.name}</td><td>{order.seller_name}</td><td>{order.total_units}</td><td>{formatPrice(order.discount_total_cents)}</td><td className="font-black">{formatPrice(order.total_cents)}</td><td>{formatPrice(order.commission_total_cents)}</td><td><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${order.status === "completed" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{order.status === "completed" ? "Finalizado" : "Cancelado"}</span></td></tr>)}</tbody></table>{!orders.length && <p className="py-10 text-center text-sm text-ink-500">Nenhum pedido corresponde ao período e filtros selecionados.</p>}</div></PanelCard>
  </>;
}

function Metric({ title, value, tone = "default" }: { title: string; value: string; tone?: "default" | "green" | "gold" }) { return <PanelCard className="p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{title}</p><p className={`mt-2 text-xl font-black ${tone === "green" ? "text-green-700" : tone === "gold" ? "text-gold-800" : "text-ink-900"}`}>{value}</p></PanelCard>; }
function Rule({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3 border-b border-ink-100 pb-2 last:border-0"><span className="text-ink-500">{label}</span><strong>{value}/un.</strong></div>; }
function RangeLink({ label, from, to }: { label: string; from: string; to: string }) { return <Link href={`/painel/financeiro?de=${from}&ate=${to}&status=completed`} className="rounded-full border border-ink-200 px-3 py-1.5 font-bold text-ink-600 hover:border-gold-400 hover:bg-gold-50">{label}</Link>; }
function previousMonthRange() { const now = new Date(); const current = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(now); const [year, month] = current.split("-").map(Number); const first = new Date(Date.UTC(year, month - 2, 1)); const last = new Date(Date.UTC(year, month - 1, 0)); return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) }; }
