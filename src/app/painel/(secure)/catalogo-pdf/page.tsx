/* eslint-disable @next/next/no-img-element */
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { PrintButton } from "@/components/admin/PrintButton";
import { getAdminCategories, getAdminProducts, getVendaLojistas } from "@/lib/admin/data";
import { mostraPrecoSite, precoComDesconto } from "@/lib/admin/lojistas";
import { formatPrice } from "@/lib/utils/format";

type Params = Record<string, string | string[] | undefined>;

export default async function CatalogPdfPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const [allProducts, categories, venda] = await Promise.all([getAdminProducts(), getAdminCategories(), getVendaLojistas()]);
  const lojista = params.publico === "lojista";
  const category = typeof params.categoria === "string" ? params.categoria : "";
  const onlyOffers = params.ofertas === "1";
  const showStock = params.estoque === "1";
  const showVariants = params.variacoes === "1";
  // Para lojista, esgotado nunca aparece (mesma regra da tabela de lojistas).
  const availability = lojista || params.disponibilidade === "estoque" ? "estoque" : "todos";
  const search = typeof params.busca === "string" ? params.busca.trim() : "";
  const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  const products = allProducts.filter((product) => product.status === "active" && (!category || product.category_id === category) && (!onlyOffers || product.is_offer));
  // Com "Mostrar variacoes", cada opcao (cor, voltagem) vira um card proprio com foto, preco, estoque e SKU dela.
  const cards = products.flatMap((product) => {
    const image = [...(product.product_images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0]?.src;
    const variants = showVariants ? (product.product_variants ?? []).filter((variant) => variant.active) : [];
    const base = { key: product.id, chave: product.id, product, name: product.name, image, price: product.price_cents, stock: product.stock, sku: product.sku, label: "" };
    return variants.length === 0 ? [base] : variants.map((variant) => ({ ...base, key: variant.id, chave: `${product.id}::${variant.id}`, name: `${product.name} - ${variant.label}`, image: variant.image_src || image, price: variant.price_cents, stock: variant.stock, sku: variant.sku, label: variant.label }));
  }).filter((card) => (availability !== "estoque" || card.stock > 0) && (!lojista || card.price > 0) && terms.every((term) => normalize(`${card.name} ${card.product.brand ?? ""} ${card.sku} ${card.product.sku}`).includes(term)));
  return <>
    <div className="admin-no-print"><AdminPageHeader eyebrow="Divulgacao" title="Catalogo PDF" description="Escolha todos os itens ou somente os que estão em estoque e salve o PDF." actions={<PrintButton />} /><PanelCard className="mb-7"><form className="grid gap-3 sm:grid-cols-[150px_1fr_1fr_180px_auto_auto_auto_auto] sm:items-end"><label className="text-xs font-bold">Catálogo para<select name="publico" defaultValue={lojista ? "lojista" : "cliente"} className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"><option value="cliente">Cliente</option><option value="lojista">Lojista</option></select></label><label className="text-xs font-bold">Buscar<input type="search" name="busca" defaultValue={search} placeholder="Ex.: Stanley, smart tv" className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm" /></label><label className="text-xs font-bold">Categoria<select name="categoria" defaultValue={category} className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"><option value="">Todas</option>{categories.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-xs font-bold">Itens<select name="disponibilidade" defaultValue={availability} disabled={lojista} title={lojista ? "Para lojista, só itens em estoque" : undefined} className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"><option value="todos">Todos os itens</option><option value="estoque">Somente em estoque</option></select></label><label className="pb-2 text-sm font-semibold"><input type="checkbox" name="ofertas" value="1" defaultChecked={onlyOffers} className="mr-2 accent-gold-500" />Somente ofertas</label><label className="pb-2 text-sm font-semibold"><input type="checkbox" name="estoque" value="1" defaultChecked={showStock} className="mr-2 accent-gold-500" />Mostrar estoque</label><label className="pb-2 text-sm font-semibold"><input type="checkbox" name="variacoes" value="1" defaultChecked={showVariants} className="mr-2 accent-gold-500" />Mostrar variações</label><button className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-bold text-white">Atualizar</button></form></PanelCard></div>
    <section className="mx-auto max-w-[210mm] bg-white p-6 print:max-w-none print:p-0">
      <header className="mb-6 flex items-end justify-between border-b-2 border-gold-400 pb-4"><div><p className="text-2xl font-black tracking-tight">DOM GUIMA</p><p className="text-xs uppercase tracking-[0.2em] text-ink-500">Emporio das Ofertas</p></div><div className="text-right text-xs text-ink-500"><p>{lojista ? "Tabela para lojistas" : "Catalogo de produtos"}</p><p>{new Date().toLocaleDateString("pt-BR")}</p></div></header>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">{cards.map(({ key, chave, product, name, image, price, stock, sku, label }) => <article key={key} className="break-inside-avoid overflow-hidden rounded-xl border border-ink-200"><div className="aspect-[4/3] bg-white">{image ? <img src={image} alt="" className="h-full w-full object-contain p-2" /> : <div className="flex h-full items-center justify-center text-xs text-ink-400">Sem foto</div>}</div><div className="border-t border-ink-100 p-3"><p className="line-clamp-2 text-xs font-bold leading-snug">{name}</p>{label && <p className="mt-1 text-[9px] font-bold text-ink-600">{product.variant_axis || "Opção"}: {label}</p>}{product.brand && <p className="mt-1 text-[9px] uppercase tracking-wide text-ink-400">{product.brand}</p>}<div className="mt-2 flex items-end justify-between gap-2">{lojista ? <div>{mostraPrecoSite(venda) && <p className="text-[9px] text-ink-400">Site: {formatPrice(price)}</p>}<p className="text-sm font-black">{formatPrice(venda.precos[chave] ?? precoComDesconto(price, venda.descontoPercent))}</p><p className="text-[8px] font-bold uppercase text-gold-600">Preço lojista</p></div> : <div>{product.old_price_cents && product.old_price_cents > price && <p className="text-[9px] text-ink-400 line-through">{formatPrice(product.old_price_cents)}</p>}<p className="text-sm font-black">{formatPrice(price)}</p></div>}{!lojista && product.is_offer && <span className="rounded bg-red-600 px-1.5 py-1 text-[8px] font-black text-white">OFERTA</span>}</div>{showStock && <p className="mt-1 text-[9px] text-ink-500">Estoque: {stock}</p>}<p className="mt-2 text-[8px] text-ink-400">SKU {sku}</p></div></article>)}</div>
      {cards.length === 0 && <p className="py-20 text-center text-sm text-ink-500">Nenhum produto corresponde aos filtros.</p>}
      <footer className="mt-8 border-t border-ink-200 pt-3 text-center text-[9px] text-ink-400">{lojista && venda.condicoes && <p className="mb-1 whitespace-pre-line text-ink-600">{venda.condicoes}</p>}Precos e disponibilidade sujeitos a confirmacao no atendimento da Dom Guima.</footer>
    </section>
  </>;
}
