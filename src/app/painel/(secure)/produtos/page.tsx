import Link from "next/link";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { archiveProductAction, duplicateProductAction } from "@/app/painel/actions";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";
import { getAdminProducts, getAllProductOperationalMeta } from "@/lib/admin/data";
import { formatPrice } from "@/lib/utils/format";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const term = typeof params.q === "string" ? params.q.toLowerCase().trim() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const erro = typeof params.erro === "string" ? params.erro : "";
  const excluido = typeof params.excluido === "string" ? params.excluido : "";
  const [all, meta] = await Promise.all([getAdminProducts(), getAllProductOperationalMeta()]);
  // Sem filtro escolhido, arquivado NAO aparece. Antes ele continuava na
  // lista depois de arquivado, e por isso o botao parecia nao fazer nada.
  // O NCM mora nas anotacoes operacionais, nao na tabela de produtos; SKU de
  // variacao tambem entra, senao buscar "DG-ELT-002-PRETO" nao acharia nada.
  const buscavel = (item: (typeof all)[number]) => {
    const anotacoes = meta.get(item.id);
    const variacoes = (item.product_variants ?? []).map((linha) => `${linha.label} ${linha.sku}`).join(" ");
    return `${item.name} ${item.sku} ${item.brand ?? ""} ${anotacoes?.ncm ?? ""} ${anotacoes?.model ?? ""} ${anotacoes?.gtin ?? ""} ${variacoes}`.toLowerCase();
  };
  const products = all.filter((item) => (!term || buscavel(item).includes(term)) && (status ? item.status === status : item.status !== "archived"));
  const arquivados = all.filter((item) => item.status === "archived").length;
  return <>
    <AdminPageHeader eyebrow="Catalogo" title="Produtos" description={`${products.length} de ${all.length} produtos${arquivados && !status ? ` · ${arquivados} arquivado(s) ocultos` : ""}`} actions={<Link href="/painel/produtos/novo" className="rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-extrabold text-ink-950">+ Novo produto</Link>} />
    {excluido && <div role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><strong>“{excluido}” foi excluído.</strong> O cadastro e as fotos saíram em definitivo.</div>}
    {erro && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
    <PanelCard className="mb-4 p-4">
      <form className="grid gap-3 sm:grid-cols-[1fr_190px_auto]">
        <input name="q" defaultValue={term} placeholder="Nome, SKU, marca, NCM, modelo ou EAN" className="rounded-lg border border-ink-200 px-3 py-2.5 text-sm" />
        <select name="status" defaultValue={status} className="rounded-lg border border-ink-200 px-3 py-2.5 text-sm"><option value="">Ativos e rascunhos</option><option value="active">Publicados</option><option value="draft">Rascunhos</option><option value="archived">Arquivados</option></select>
        <button className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-bold text-white">Filtrar</button>
      </form>
    </PanelCard>
    <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Preco</th><th className="px-4 py-3">Estoque</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3 text-right">Acoes</th></tr></thead><tbody className="divide-y divide-ink-100">{products.map((product) => <tr key={product.id} className="hover:bg-ink-50/70"><td className="max-w-md px-4 py-3"><Link href={`/painel/produtos/${encodeURIComponent(product.id)}`} className="font-bold text-ink-900 hover:text-gold-800">{product.name}</Link><p className="mt-0.5 text-xs text-ink-400">SKU {product.sku}{meta.get(product.id)?.ncm ? ` · NCM ${meta.get(product.id)!.ncm}` : ""}</p></td><td className="px-4 py-3 font-bold">{formatPrice(product.price_cents)}</td><td className={`px-4 py-3 font-bold ${product.stock === 0 ? "text-red-600" : product.stock <= product.low_stock_threshold ? "text-orange-600" : "text-ink-700"}`}>{product.stock}</td><td className="px-4 py-3"><Status value={product.status} /></td><td className="px-4 py-3 text-ink-500">{product.categories?.name ?? product.category_id}</td><td className="px-4 py-3"><div className="flex justify-end gap-3"><Link href={`/produto/${product.slug}`} target="_blank" className="text-xs font-bold text-ink-500 hover:text-ink-900">Ver</Link><Link href={`/painel/produtos/${encodeURIComponent(product.id)}`} className="text-xs font-bold text-gold-800">Editar</Link><form action={duplicateProductAction}><input type="hidden" name="id" value={product.id} /><button className="text-xs font-bold text-blue-700">Duplicar</button></form>{product.status !== "archived" && <form action={archiveProductAction}><input type="hidden" name="id" value={product.id} /><button className="text-xs font-bold text-orange-700">Arquivar</button></form>}<DeleteProductButton id={product.id} name={product.name} /></div></td></tr>)}</tbody></table></div>
      {products.length === 0 && <p className="p-10 text-center text-sm text-ink-500">Nenhum produto encontrado.</p>}
    </div>
  </>;
}

function Status({ value }: { value: string }) { const label = value === "active" ? "Publicado" : value === "draft" ? "Rascunho" : "Arquivado"; const style = value === "active" ? "bg-success-light text-success" : value === "draft" ? "bg-gold-50 text-gold-800" : "bg-ink-100 text-ink-600"; return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${style}`}>{label}</span>; }
