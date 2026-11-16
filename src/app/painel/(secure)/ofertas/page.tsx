import { OfferScheduleForm } from "@/components/admin/OfferScheduleForm";
import { OfferSelectionForm } from "@/components/admin/OfferSelectionForm";
import { readCatalogState } from "@/lib/admin/catalog-store";
import { loadCatalogProducts } from "@/lib/catalog/database";
import { offerIsScheduledNow, readOfferSchedule } from "@/lib/catalog/offer-schedule";
import Link from "next/link";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { getAdminProducts } from "@/lib/admin/data";
import { formatPrice } from "@/lib/utils/format";

export default async function OffersAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const relampago = query.aba === "relampago";
  const num = (key: string) => { const n = Number(String(query[key] ?? "").replace(",", ".")); return String(query[key] ?? "") !== "" && Number.isFinite(n) && n >= 0 ? n : null; };
  const filtro = { descMin: num("desc_min"), descMax: num("desc_max"), precoMin: num("preco_min"), precoMax: num("preco_max") };
  const [products, state, publicProducts] = await Promise.all([getAdminProducts(), readCatalogState(), loadCatalogProducts()]);
  const published = new Set(publicProducts.filter(product => product.isOffer && product.stock > 0 && product.oldPrice && product.oldPrice > product.price).map(product => product.id));
  const active = products.filter((product) => product.status !== "archived");
  const offers = active.filter((product) => product.is_offer);
  const invalid = offers.filter((product) => !product.old_price_cents || product.old_price_cents <= product.price_cents);
  const meta = state.operations.product_meta;
  const flashCount = offers.filter(product => meta[product.id]?.flash_offer).length;
  const statusOf = (product: (typeof active)[number]) => !product.is_offer ? "Fora das ofertas" : published.has(product.id) ? "Visível em Ofertas" : !offerIsScheduledNow(readOfferSchedule(meta[product.id])) ? "Fora do período" : product.stock <= 0 ? "Sem estoque" : product.status === "draft" ? "Rascunho" : "Revisar desconto (preço anterior precisa ser maior)";
  const discountOf = (product: (typeof active)[number]) => product.old_price_cents && product.old_price_cents > product.price_cents ? Math.round((1 - product.price_cents / product.old_price_cents) * 100) : 0;
  // Só produtos com estoque; os filtros escondem linhas, e o Salvar só mexe nas linhas visíveis.
  const list = (relampago ? offers : active).filter(product => product.stock > 0
    && (filtro.descMin === null || discountOf(product) >= filtro.descMin) && (filtro.descMax === null || discountOf(product) <= filtro.descMax)
    && (filtro.precoMin === null || product.price_cents >= filtro.precoMin * 100) && (filtro.precoMax === null || product.price_cents <= filtro.precoMax * 100));
  const rows = list.map(product => {
    const discount = discountOf(product);
    return {
      id: product.id,
      checked: relampago ? Boolean(meta[product.id]?.flash_offer) : product.is_offer,
      content: <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
        <div><p className="font-bold">{product.name}{!relampago && meta[product.id]?.flash_offer && product.is_offer && <span className="ml-2 text-xs text-orange-600">🔥 Relâmpago</span>}</p><p className="text-xs text-ink-500">SKU {product.sku} · {statusOf(product)}</p></div>
        <div className="sm:text-right"><p className="text-xs text-ink-400 line-through">{product.old_price_cents ? formatPrice(product.old_price_cents) : "Sem preço anterior"}</p><p className="font-black">{formatPrice(product.price_cents)} {discount > 0 && <span className="text-xs text-success">(-{discount}%)</span>}</p></div>
        <Link href={`/painel/produtos/${encodeURIComponent(product.id)}`} className="rounded-lg border border-ink-200 px-3 py-2 text-center text-xs font-bold hover:border-gold-400">Editar</Link>
      </div>,
      extra: !relampago && product.is_offer ? <div className="pl-8"><OfferScheduleForm id={product.id} schedule={readOfferSchedule(meta[product.id])} /></div> : undefined,
    };
  });
  const aba = (on: boolean) => `rounded-lg px-4 py-2 text-sm font-extrabold ${on ? "bg-ink-950 text-white" : "border border-ink-200 hover:border-gold-400"}`;
  return <>
    <AdminPageHeader eyebrow="Vitrine comercial" title="Ofertas" description="Marque os produtos que entram em Ofertas e salve. Uma oferta só aparece na loja quando tem preço anterior maior que o preço atual." />
    <div className="mb-5 grid gap-3 sm:grid-cols-4">
      <PanelCard className="p-4"><p className="text-xs font-semibold text-ink-500">Ofertas marcadas</p><p className="mt-2 text-3xl font-black">{offers.length}</p></PanelCard>
      <PanelCard className="p-4"><p className="text-xs font-semibold text-ink-500">Publicadas</p><p className="mt-2 text-3xl font-black text-success">{offers.filter(item => published.has(item.id)).length}</p></PanelCard>
      <PanelCard className="p-4"><p className="text-xs font-semibold text-ink-500">Precisam de revisão</p><p className="mt-2 text-3xl font-black text-red-600">{invalid.length}</p></PanelCard>
      <PanelCard className="p-4"><p className="text-xs font-semibold text-ink-500">Relâmpago</p><p className="mt-2 text-3xl font-black text-orange-600">{flashCount}</p></PanelCard>
    </div>
    <nav className="mb-4 flex gap-2">
      <Link href="/painel/ofertas" className={aba(!relampago)}>Todos os produtos</Link>
      <Link href="/painel/ofertas?aba=relampago" className={aba(relampago)}>🔥 Oferta relâmpago</Link>
    </nav>
    <form className="mb-4 flex flex-wrap items-end gap-3 text-xs">
      {relampago && <input type="hidden" name="aba" value="relampago" />}
      {([["desc_min", "Desconto mín. (%)"], ["desc_max", "Desconto máx. (%)"], ["preco_min", "Preço mín. (R$)"], ["preco_max", "Preço máx. (R$)"]] as const).map(([name, label]) =>
        <label key={name} className="font-bold">{label}<input type="number" min="0" step="any" name={name} defaultValue={String(query[name] ?? "")} className="mt-1 block w-32 rounded border border-ink-200 bg-white p-2" /></label>)}
      <button className="rounded-lg bg-ink-950 px-4 py-2.5 font-extrabold text-white">Filtrar</button>
      <Link href={relampago ? "/painel/ofertas?aba=relampago" : "/painel/ofertas"} className="px-2 py-2.5 font-bold text-ink-500 underline">Limpar</Link>
      <span className="ml-auto self-center text-ink-500">{rows.length} produto(s) com estoque</span>
    </form>
    <PanelCard>
      {relampago &&<p className="pt-3 text-xs text-ink-500">Os marcados aqui ganham o efeito de fogo em volta do card na loja. Só aparecem os produtos que já estão em Ofertas.</p>}
      {rows.length > 0
        ? <OfferSelectionForm key={relampago ? "flash" : "offer"} field={relampago ? "flash" : "offer"} label={relampago ? "Oferta relâmpago" : "Mostrar em Ofertas"} rows={rows} />
        : <p className="py-10 text-center text-sm text-ink-500">{relampago ? "Nenhum produto em Ofertas ainda. Marque na aba Todos os produtos." : "Nenhum produto cadastrado."}</p>}
    </PanelCard>
  </>;
}
