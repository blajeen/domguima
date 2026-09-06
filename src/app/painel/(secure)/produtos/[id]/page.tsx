import { notFound } from "next/navigation";
import { duplicateProductAction } from "@/app/painel/actions";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductImages } from "@/components/admin/ProductImages";
import { requireOwner } from "@/lib/admin/auth";
import { getAdminCategories, getAdminProduct, getProductAssistTemplates, getProductOperationalMeta } from "@/lib/admin/data";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; duplicado?: string }>;
};

export default async function EditProductPage({ params, searchParams }: EditProductPageProps) {
  await requireOwner();
  const { id } = await params;
  const { created, duplicado } = await searchParams;
  const [product, categories, operationalMeta, templates] = await Promise.all([getAdminProduct(id), getAdminCategories(), getProductOperationalMeta(id), getProductAssistTemplates(id)]);
  if (!product) notFound();
  return <>
    <AdminPageHeader
      eyebrow="Catalogo"
      title="Editar produto"
      description={`SKU ${product.sku} · ${product.stock} unidade(s) em estoque`}
      actions={<form action={duplicateProductAction}><input type="hidden" name="id" value={product.id} /><button className="rounded-lg border border-ink-300 bg-white px-4 py-2.5 text-sm font-extrabold text-ink-800">Duplicar produto</button></form>}
    />
    {duplicado === "1" && <div role="status" className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <strong>Cópia criada como rascunho, com o SKU {product.sku}.</strong> Estoque zerado e avaliações não vieram junto — são do produto original. Revise o nome e publique quando estiver pronto.
    </div>}
    {created === "1" && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <strong>Produto criado e publicado com sucesso.</strong> Agora você já pode adicionar todas as fotos de uma vez abaixo.
    </div>}
    <ProductForm product={product} categories={categories} operationalMeta={operationalMeta} templates={templates} />
    <ProductImages productId={product.id} images={product.product_images ?? []} />
  </>;
}
