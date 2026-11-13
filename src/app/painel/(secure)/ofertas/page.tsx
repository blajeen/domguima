import { OfferScheduleForm } from "@/components/admin/OfferScheduleForm";
import { readCatalogState } from "@/lib/admin/catalog-store";
import { loadCatalogProducts } from "@/lib/catalog/database";
import { offerIsScheduledNow, readOfferSchedule } from "@/lib/catalog/offer-schedule";
import Link from "next/link";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { getAdminProducts } from "@/lib/admin/data";
import { formatPrice } from "@/lib/utils/format";

export default async function OffersAdminPage() {
  const [products, state, publicProducts] = await Promise.all([getAdminProducts(), readCatalogState(), loadCatalogProducts()]);
  const published = new Set(publicProducts.filter(product => product.isOffer && product.stock > 0 && product.oldPrice && product.oldPrice > product.price).map(product => product.id));
  const offers = products.filter((product) => product.is_offer && product.status !== "archived");
  const invalid = offers.filter((product) => !product.old_price_cents || product.old_price_cents <= product.price_cents);
  return <>
    <AdminPageHeader eyebrow="Vitrine comercial" title="Ofertas" description="Uma oferta so aparece na loja quando esta marcada e tem preco anterior maior que o preco atual." actions={<Link href="/painel/produtos/novo" className="rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-extrabold text-ink-950">+ Cadastrar oferta</Link>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <PanelCard className="p-4"><p className="text-xs font-semibold text-ink-500">Ofertas configuradas</p><p className="mt-2 text-3xl font-black">{offers.length}</p></PanelCard>
      <PanelCard className="p-4"><p className="text-xs font-semibold text-ink-500">Publicadas</p><p className="mt-2 text-3xl font-black text-success">{offers.filter(item => published.has(item.id)).length}</p></PanelCard>
      <PanelCard className="p-4"><p className="text-xs font-semibold text-ink-500">Precisam de revisao</p><p className="mt-2 text-3xl font-black text-red-600">{invalid.length}</p></PanelCard>
    </div>
    <PanelCard>
      <div className="divide-y divide-ink-100">{offers.map((product) => {
        const discount = product.old_price_cents ? Math.round((1 - product.price_cents / product.old_price_cents) * 100) : 0;
        return <div key={product.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="font-bold">{product.name}</p><p className="text-xs text-ink-500">SKU {product.sku} · {published.has(product.id) ? "Visível em Ofertas" : !offerIsScheduledNow(readOfferSchedule(state.operations.product_meta[product.id])) ? "Fora do período" : product.stock <= 0 ? "Sem estoque" : product.status === "draft" ? "Rascunho" : "Revisar desconto"}</p></div><div className="sm:text-right"><p className="text-xs text-ink-400 line-through">{product.old_price_cents ? formatPrice(product.old_price_cents) : "Sem preco anterior"}</p><p className="font-black">{formatPrice(product.price_cents)} {discount > 0 && <span className="text-xs text-success">(-{discount}%)</span>}</p></div><Link href={`/painel/produtos/${encodeURIComponent(product.id)}`} className="rounded-lg border border-ink-200 px-3 py-2 text-center text-xs font-bold hover:border-gold-400">Editar oferta</Link><div className="sm:col-span-3"><OfferScheduleForm id={product.id} schedule={readOfferSchedule(state.operations.product_meta[product.id])} /></div></div>;
      })}</div>
      {offers.length === 0 && <div className="py-10 text-center"><p className="text-sm text-ink-500">Nenhuma oferta cadastrada.</p><p className="mt-1 text-xs text-ink-400">Edite um produto, informe o preco anterior e marque a opcao Oferta.</p></div>}
    </PanelCard>
  </>;
}
