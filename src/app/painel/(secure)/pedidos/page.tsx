import Link from "next/link";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { CancelOrderForm } from "@/components/admin/CancelOrderForm";
import { getSalesOrders, getSellers } from "@/lib/admin/data";
import { formatPrice, normalize } from "@/lib/utils/format";

type Params = Record<string, string | string[] | undefined>;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const [allOrders, sellers] = await Promise.all([getSalesOrders(), getSellers()]);
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const seller = typeof params.vendedor === "string" ? params.vendedor : "";
  const status = params.status === "cancelled" ? "cancelled" : params.status === "completed" ? "completed" : "";
  const orders = allOrders.filter((order) => {
    const searchable = normalize(`${order.number} ${order.customer.name} ${order.customer.cpf} ${order.seller_name} ${order.items.map((item) => `${item.product_name} ${item.sku}`).join(" ")}`);
    return (!query || searchable.includes(normalize(query))) && (!seller || order.seller_id === seller) && (!status || order.status === status);
  });
  const created = typeof params.criado === "string" ? allOrders.find((order) => order.id === params.criado) : null;
  const cancelled = typeof params.cancelado === "string";

  return <>
    <AdminPageHeader eyebrow="Operação comercial" title="Pedidos" description={`${orders.length} de ${allOrders.length} pedidos`} actions={<Link href="/painel/pedidos/novo" className="rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-extrabold text-ink-950">+ Novo pedido</Link>} />
    {created && <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><strong>Pedido {created.number} finalizado.</strong> O estoque e a comissão foram atualizados.</div>}
    {cancelled && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Pedido cancelado e produtos devolvidos ao estoque.</div>}
    <PanelCard>
      <form className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_180px_180px_auto] sm:items-end">
        <label className="text-xs font-bold text-ink-600">Buscar<input name="q" defaultValue={query} placeholder="Pedido, cliente, CPF, produto ou SKU" className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm" /></label>
        <label className="text-xs font-bold text-ink-600">Vendedor<select name="vendedor" defaultValue={seller} className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"><option value="">Todos</option>{sellers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-xs font-bold text-ink-600">Status<select name="status" defaultValue={status} className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"><option value="">Todos</option><option value="completed">Finalizados</option><option value="cancelled">Cancelados</option></select></label>
        <button className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-bold text-white">Filtrar</button>
      </form>
    </PanelCard>

    <div className="mt-5 space-y-3">{orders.map((order) => <article key={order.id} className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
      <div className="grid gap-4 p-5 sm:grid-cols-[1.2fr_1fr_auto] sm:items-center">
        <div><div className="flex flex-wrap items-center gap-2"><h2 className="font-black text-ink-900">{order.number}</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${order.status === "completed" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{order.status === "completed" ? "Finalizado" : "Cancelado"}</span></div><p className="mt-1 text-sm font-semibold">{order.customer.name}</p><p className="text-xs text-ink-500">{order.customer.cpf} · {order.customer.city}/{order.customer.state}</p></div>
        <div><p className="text-xs text-ink-400">{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(order.created_at))}</p><p className="mt-1 text-sm"><strong>{order.seller_name}</strong> · {order.total_units} unidade(s)</p><p className="text-xs text-ink-500">Comissão {formatPrice(order.commission_total_cents)}</p></div>
        <div className="sm:text-right"><p className="text-2xl font-black">{formatPrice(order.total_cents)}</p>{order.discount_total_cents > 0 && <p className="text-xs text-green-700">Desconto {formatPrice(order.discount_total_cents)}</p>}</div>
      </div>
      <details className="border-t border-ink-100"><summary className="cursor-pointer px-5 py-3 text-xs font-bold text-blue-700 hover:bg-blue-50">Ver itens e dados do pedido</summary><div className="border-t border-ink-100 bg-ink-50/50 p-5"><div className="grid gap-5 lg:grid-cols-[1fr_320px]"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="uppercase text-ink-400"><tr><th className="py-2">Produto</th><th>Qtd.</th><th>Preço</th><th>Desconto</th><th>Comissão</th><th>Total</th></tr></thead><tbody className="divide-y divide-ink-200">{order.items.map((item) => <tr key={item.product_id}><td className="py-3"><strong>{item.product_name}</strong><span className="block text-ink-400">SKU {item.sku}</span></td><td>{item.quantity}</td><td>{formatPrice(item.unit_price_cents)}</td><td>{formatPrice(item.discount_cents)}</td><td>{formatPrice(item.commission_total_cents)}</td><td className="font-black">{formatPrice(item.line_total_cents)}</td></tr>)}</tbody></table></div><div className="rounded-xl border border-ink-200 bg-white p-4 text-xs leading-relaxed text-ink-600"><p className="font-black text-ink-900">Entrega</p><p className="mt-2">{order.customer.street}, {order.customer.number}{order.customer.complement ? ` · ${order.customer.complement}` : ""}</p><p>{order.customer.neighborhood} · {order.customer.city}/{order.customer.state}</p><p>CEP {order.customer.cep}</p>{order.customer.phone && <p className="mt-2">Telefone {order.customer.phone}</p>}{order.notes && <p className="mt-3 border-t border-ink-100 pt-3"><strong>Observações:</strong> {order.notes}</p>}{order.status === "completed" && <div className="mt-4"><CancelOrderForm orderId={order.id} orderNumber={order.number} /></div>}</div></div></div></details>
    </article>)}{!orders.length && <PanelCard><p className="py-10 text-center text-sm text-ink-500">Nenhum pedido corresponde aos filtros.</p></PanelCard>}</div>
  </>;
}
