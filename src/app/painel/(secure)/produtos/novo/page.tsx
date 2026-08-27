import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ProductForm } from "@/components/admin/ProductForm";
import { requireOwner } from "@/lib/admin/auth";
import { getAdminCategories, getAdminProducts, getProductAssistTemplates } from "@/lib/admin/data";
import { buildCategorySkuChoices } from "@/lib/admin/sku";

type Params = Record<string, string | string[] | undefined>;

export default async function NewProductPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOwner();
  const params = await searchParams;
  const [categories, products, templates] = await Promise.all([getAdminCategories(), getAdminProducts(), getProductAssistTemplates()]);
  const skuChoices = buildCategorySkuChoices(categories, products);
  const requestedCategory = typeof params.categoria === "string" ? params.categoria : "";
  const selected = skuChoices.find((choice) => choice.categoryId === requestedCategory);

  if (!selected) return <>
    <AdminPageHeader eyebrow="Novo produto · Passo 1 de 2" title="Selecione o setor" description="O painel usa o setor para gerar o próximo código do produto automaticamente." />
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {skuChoices.map((choice) => <Link key={choice.categoryId} href={`/painel/produtos/novo?categoria=${encodeURIComponent(choice.categoryId)}`} className="group rounded-xl border border-ink-200 p-4 transition hover:-translate-y-0.5 hover:border-gold-400 hover:bg-gold-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500">
          <div className="flex items-start justify-between gap-4"><span className="text-2xl" aria-hidden>{choice.categoryIcon}</span><span className="rounded-full bg-ink-50 px-2.5 py-1 text-[10px] font-bold text-ink-500 group-hover:bg-white">{choice.productCount} produto(s)</span></div>
          <h2 className="mt-4 font-black text-ink-900">{choice.categoryName}</h2>
          <p className="mt-1 text-xs text-ink-500">{choice.lastSku ? `Último código: ${choice.lastSku}` : "Nenhum código usado neste setor"}</p>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2.5"><span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Próximo código</span><strong className="font-mono text-sm text-blue-900">{choice.nextSku}</strong></div>
        </Link>)}
      </div>
      {!skuChoices.length && <p className="py-10 text-center text-sm text-ink-500">Crie ou ative uma categoria antes de cadastrar o produto.</p>}
    </section>
  </>;

  return <>
    <AdminPageHeader eyebrow="Novo produto · Passo 2 de 2" title="Cadastrar produto" description="O código foi preparado pelo setor. Salve como rascunho, adicione as fotos e depois publique." actions={<Link href="/painel/produtos/novo" className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-bold text-ink-700 hover:border-gold-400">Trocar setor</Link>} />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <span>Setor selecionado: <strong>{selected.categoryName}</strong></span>
      <span>Próximo código: <strong className="font-mono">{selected.nextSku}</strong></span>
    </div>
    <ProductForm categories={categories} initialCategoryId={selected.categoryId} skuChoices={skuChoices} templates={templates} />
  </>;
}
