/* eslint-disable @next/next/no-img-element */
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { PrintButton } from "@/components/admin/PrintButton";
import { getAdminCategories, getAdminProducts } from "@/lib/admin/data";
import { formatPrice } from "@/lib/utils/format";

type Params = Record<string, string | string[] | undefined>;

export default async function CatalogPdfPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const [allProducts, categories] = await Promise.all([getAdminProducts(), getAdminCategories()]);
  const category = typeof params.categoria === "string" ? params.categoria : "";
  const onlyOffers = params.ofertas === "1";
  const showStock = params.estoque === "1";
  const products = allProducts.filter((product) => product.status === "active" && (!category || product.category_id === category) && (!onlyOffers || product.is_offer));
  return <>
    <div className="admin-no-print"><AdminPageHeader eyebrow="Divulgacao" title="Catalogo PDF" description="Filtre o conteudo e use o botao para abrir a janela de impressao. Selecione Salvar como PDF no destino." actions={<PrintButton />} /><PanelCard className="mb-7"><form className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"><label className="text-xs font-bold">Categoria<select name="categoria" defaultValue={category} className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"><option value="">Todas</option>{categories.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="pb-2 text-sm font-semibold"><input type="checkbox" name="ofertas" value="1" defaultChecked={onlyOffers} className="mr-2 accent-gold-500" />Somente ofertas</label><label className="pb-2 text-sm font-semibold"><input type="checkbox" name="estoque" value="1" defaultChecked={showStock} className="mr-2 accent-gold-500" />Mostrar estoque</label><button className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-bold text-white">Atualizar</button></form></PanelCard></div>
    <section className="mx-auto max-w-[210mm] bg-white p-6 print:max-w-none print:p-0">
      <header className="mb-6 flex items-end justify-between border-b-2 border-gold-400 pb-4"><div><p className="text-2xl font-black tracking-tight">DOM GUIMA</p><p className="text-xs uppercase tracking-[0.2em] text-ink-500">Emporio das Ofertas</p></div><div className="text-right text-xs text-ink-500"><p>Catalogo de produtos</p><p>{new Date().toLocaleDateString("pt-BR")}</p></div></header>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">{products.map((product) => { const image = [...(product.product_images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0]; return <article key={product.id} className="break-inside-avoid overflow-hidden rounded-xl border border-ink-200"><div className="aspect-[4/3] bg-white">{image ? <img src={image.src} alt="" className="h-full w-full object-contain p-2" /> : <div className="flex h-full items-center justify-center text-xs text-ink-400">Sem foto</div>}</div><div className="border-t border-ink-100 p-3"><p className="line-clamp-2 text-xs font-bold leading-snug">{product.name}</p>{product.brand && <p className="mt-1 text-[9px] uppercase tracking-wide text-ink-400">{product.brand}</p>}<div className="mt-2 flex items-end justify-between gap-2"><div>{product.old_price_cents && <p className="text-[9px] text-ink-400 line-through">{formatPrice(product.old_price_cents)}</p>}<p className="text-sm font-black">{formatPrice(product.price_cents)}</p></div>{product.is_offer && <span className="rounded bg-red-600 px-1.5 py-1 text-[8px] font-black text-white">OFERTA</span>}</div>{showStock && <p className="mt-1 text-[9px] text-ink-500">Estoque: {product.stock}</p>}<p className="mt-2 text-[8px] text-ink-400">SKU {product.sku}</p></div></article>; })}</div>
      {products.length === 0 && <p className="py-20 text-center text-sm text-ink-500">Nenhum produto corresponde aos filtros.</p>}
      <footer className="mt-8 border-t border-ink-200 pt-3 text-center text-[9px] text-ink-400">Precos e disponibilidade sujeitos a confirmacao no atendimento da Dom Guima.</footer>
    </section>
  </>;
}
