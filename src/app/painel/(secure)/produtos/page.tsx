import Link from "next/link";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { archiveProductAction } from "@/app/painel/actions";
import { getAdminProducts } from "@/lib/admin/data";
import { formatPrice } from "@/lib/utils/format";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const term = typeof params.q === "string" ? params.q.toLowerCase().trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const all = await getAdminProducts();
  const products = all.filter((item) => (!term || `${item.name} ${item.sku} ${item.brand ?? ""}`.toLowerCase().includes(term)) && (!status || item.status === status));
  return <>
    <AdminPageHeader eyebrow="Catalogo" title="Produtos" description={`${products.length} de ${all.length} produtos`} actions={<Link href="/painel/produtos/novo" className="rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-extrabold text-ink-950">+ Novo produto</Link>} />
    <PanelCard className="mb-4 p-4">
      <form className="grid gap-3 sm:grid-cols-[1fr_190px_auto]">
        <input name="q" defaultValue={term} placeholder="Buscar por nome, SKU ou marca" className="rounded-lg border border-ink-200 px-3 py-2.5 text-sm" />
        <select name="status" defaultValue={status} className="rounded-lg border border-ink-200 px-3 py-2.5 text-sm"><option value="">Todos os status</option><option value="active">Publicados</option><option value="draft">Rascunhos</option><option value="archived">Arquivados</option></select>
        <button className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-bold text-white">Filtrar</button>
      </form>
    </PanelCard>
    <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Preco</th><th className="px-4 py-3">Estoque</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3 text-right">Acoes</th></tr></thead><tbody className="divide-y divide-ink-100">{products.map((product) => <tr key={product.id} className="hover:bg-ink-50/70"><td className="max-w-md px-4 py-3"><Link href={`/painel/produtos/${encodeURIComponent(product.id)}`} className="font-bold text-ink-900 hover:text-gold-800">{product.name}</Link><p className="mt-0.5 text-xs text-ink-400">SKU {product.sku}</p></td><td className="px-4 py-3 font-bold">{formatPrice(product.price_cents)}</td><td className={`px-4 py-3 font-bold ${product.stock === 0 ? "text-red-600" : product.stock <= product.low_stock_threshold ? "text-orange-600" : "text-ink-700"}`}>{product.stock}</td><td className="px-4 py-3"><Status value={product.status} /></td><td className="px-4 py-3 text-ink-500">{product.categories?.name ?? product.category_id}</td><td className="px-4 py-3"><div className="flex justify-end gap-3"><Link href={`/produto/${product.slug}`} target="_blank" className="text-xs font-bold text-ink-500 hover:text-ink-900">Ver</Link><Link href={`/painel/produtos/${encodeURIComponent(product.id)}`} className="text-xs font-bold text-gold-800">Editar</Link>{product.status !== "archived" && <form action={archiveProductAction}><input type="hidden" name="id" value={product.id} /><button className="text-xs font-bold text-red-600">Arquivar</button></form>}</div></td></tr>)}</tbody></table></div>
      {products.length === 0 && <p className="p-10 text-center text-sm text-ink-500">Nenhum produto encontrado.</p>}
    </div>
  </>;
}

function Status({ value }: { value: string }) { const label = value === "active" ? "Publicado" : value === "draft" ? "Rascunho" : "Arquivado"; const style = value === "active" ? "bg-success-light text-success" : value === "draft" ? "bg-gold-50 text-gold-800" : "bg-ink-100 text-ink-600"; return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${style}`}>{label}</span>; }
