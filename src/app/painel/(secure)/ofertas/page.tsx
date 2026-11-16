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
  // Clique num número do topo: a lista mostra só aqueles (com ou sem estoque, para bater com o número).
  const VISOES = { marcadas: { titulo: "Ofertas marcadas", itens: offers }, publicadas: { titulo: "Publicadas", itens: offers.filter(item => published.has(item.id)) }, revisao: { titulo: "Precisam de revisão", itens: invalid } } as const;
  const ver = !relampago && typeof query.ver === "string" && query.ver in VISOES ? query.ver as keyof typeof VISOES : null;
  const semAcento = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const nome = semAcento(String(query.nome ?? "").trim());
  // Sem visão escolhida, só produtos com estoque; os filtros escondem linhas, e o Salvar só mexe nas linhas visíveis.
  const list = (relampago ? offers : ver ? VISOES[ver].itens : active).filter(product => (ver || product.stock > 0)
    && (!nome || semAcento(`${product.name} ${product.sku}`).includes(nome))
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
  const cartao = (href: string, on: boolean, label: string, valor: number, cor: string) => <Link href={href} aria-current={on ? "page" : undefined} className={`block rounded-2xl transition hover:-translate-y-0.5 ${on ? "ring-2 ring-gold-400" : ""}`}><PanelCard className="h-full p-4 hover:border-gold-400"><p className="text-xs font-semibold text-ink-500">{label} <span aria-hidden>→</span></p><p className={`mt-2 text-3xl font-black ${cor}`}>{valor}</p></PanelCard></Link>;
  const base = relampago ? "/painel/ofertas?aba=relampago" : ver ? `/painel/ofertas?ver=${ver}` : "/painel/ofertas";
  return <>
    <AdminPageHeader eyebrow="Vitrine comercial" title="Ofertas" description="Marque os produtos que entram em Ofertas e salve. Uma oferta só aparece na loja quando tem preço anterior maior que o preço atual." />
    <div className="mb-5 grid gap-3 sm:grid-cols-4">
      {cartao("/painel/ofertas?ver=marcadas", ver === "marcadas", "Ofertas marcadas", VISOES.marcadas.itens.length, "")}
      {cartao("/painel/ofertas?ver=publicadas", ver === "publicadas", "Publicadas", VISOES.publicadas.itens.length, "text-success")}
      {cartao("/painel/ofertas?ver=revisao", ver === "revisao", "Precisam de revisão", VISOES.revisao.itens.length, "text-red-600")}
      {cartao("/painel/ofertas?aba=relampago", relampago, "Relâmpago", flashCount, "text-orange-600")}
    </div>
    {ver && <p className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-gold-50 px-3 py-2 text-sm">Mostrando: <strong>{VISOES[ver].titulo}</strong> (com e sem estoque). <Link href="/painel/ofertas" className="font-bold underline">Ver todos os produtos</Link></p>}
    <nav className="mb-4 flex gap-2">
      <Link href="/painel/ofertas" className={aba(!relampago)}>Todos os produtos</Link>
      <Link href="/painel/ofertas?aba=relampago" className={aba(relampago)}>🔥 Oferta relâmpago</Link>
    </nav>
    <form className="mb-4 flex flex-wrap items-end gap-3 text-xs">
      {relampago && <input type="hidden" name="aba" value="relampago" />}
      {ver && <input type="hidden" name="ver" value={ver} />}
      <label className="font-bold">Nome ou SKU<input type="search" name="nome" defaultValue={String(query.nome ?? "")} placeholder="Ex.: ventilador" className="mt-1 block w-52 rounded border border-ink-200 bg-white p-2" /></label>
      {([["desc_min", "Desconto mín. (%)"], ["desc_max", "Desconto máx. (%)"], ["preco_min", "Preço mín. (R$)"], ["preco_max", "Preço máx. (R$)"]] as const).map(([name, label]) =>
        <label key={name} className="font-bold">{label}<input type="number" min="0" step="any" name={name} defaultValue={String(query[name] ?? "")} className="mt-1 block w-32 rounded border border-ink-200 bg-white p-2" /></label>)}
      <button className="rounded-lg bg-ink-950 px-4 py-2.5 font-extrabold text-white">Filtrar</button>
      <Link href={base} className="px-2 py-2.5 font-bold text-ink-500 underline">Limpar</Link>
      <span className="ml-auto self-center text-ink-500">{rows.length} produto(s){ver ? "" : " com estoque"}</span>
    </form>
    <PanelCard>
      {relampago &&<p className="pt-3 text-xs text-ink-500">Os marcados aqui ganham o efeito de fogo em volta do card na loja. Só aparecem os produtos que já estão em Ofertas.</p>}
      {rows.length > 0
        ? <OfferSelectionForm key={relampago ? "flash" : `offer-${ver ?? "todos"}`} field={relampago ? "flash" : "offer"} label={relampago ? "Oferta relâmpago" : "Mostrar em Ofertas"} rows={rows} />
        : <p className="py-10 text-center text-sm text-ink-500">{nome || Object.values(filtro).some(value => value !== null) ? "Nenhum produto com esse filtro." : relampago ? "Nenhum produto em Ofertas ainda. Marque na aba Todos os produtos." : "Nenhum produto aqui."}</p>}
    </PanelCard>
  </>;
}
