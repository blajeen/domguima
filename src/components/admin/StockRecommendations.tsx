import Link from "next/link";
import { recentUnits, stockCoverage } from "@/lib/admin/catalog-insights";
import type { InventorySheetProduct, SalesOrderRecord } from "@/lib/admin/types";

export function StockRecommendations({ products, orders }: { products: InventorySheetProduct[]; orders: SalesOrderRecord[] }) {
  const sold = recentUnits(orders);
  const rows = products.filter(product => product.status === "active").flatMap(product => {
    const units = sold.get(product.id) ?? 0;
    const coverage = stockCoverage(product.stock, units);
    return coverage && coverage.days < 30 ? [{ product, units, ...coverage }] : [];
  }).sort((a,b) => a.days - b.days || b.units - a.units);
  return <section id="reposicao" className="mb-5 rounded-2xl border border-ink-100 bg-white p-5 shadow-card" aria-labelledby="stock-recommendations-title"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 id="stock-recommendations-title" className="text-base font-black">Prioridade de reposição</h2><span className="text-xs text-ink-500">{rows.length} item(ns) com cobertura menor que 30 dias</span></div><p className="mt-1 text-xs leading-relaxed text-ink-500">Estimativa pela média diária dos pedidos finalizados nos últimos 30 dias. Reposição busca cobrir 30 dias; confira prazo do fornecedor e sazonalidade antes de comprar. Itens sem vendas identificadas não recebem previsão.</p>{!rows.length ? <p className="mt-4 text-sm text-ink-600">Nenhum item com vendas recentes precisa de reposição por esta regra.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="text-ink-500"><tr><th scope="col" className="py-2">Produto</th><th scope="col">Vendidos (30d)</th><th scope="col">Estoque</th><th scope="col">Cobertura</th><th scope="col">Repor</th></tr></thead><tbody className="divide-y divide-ink-100">{rows.slice(0,8).map(row => <tr key={row.product.id}><td className="max-w-64 py-3 pr-3"><Link href={`/painel/produtos/${encodeURIComponent(row.product.product_id)}`} className="font-bold hover:underline">{row.product.name}</Link></td><td>{row.units}</td><td>{row.product.stock}</td><td className={row.days < 7 ? "font-bold text-red-700" : "text-orange-700"}>{row.days.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias</td><td className="font-black">{row.replenish} un.</td></tr>)}</tbody></table></div>}{rows.length > 8 && <p className="mt-2 text-xs text-ink-500">Mostrando as 8 prioridades com menor cobertura.</p>}</section>;
}
