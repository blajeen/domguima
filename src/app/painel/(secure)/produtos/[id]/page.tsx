import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductImages } from "@/components/admin/ProductImages";
import { requireOwner } from "@/lib/admin/auth";
import { getAdminCategories, getAdminProduct, getProductAssistTemplates, getProductOperationalMeta } from "@/lib/admin/data";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function EditProductPage({ params, searchParams }: EditProductPageProps) {
  await requireOwner();
  const { id } = await params;
  const { created } = await searchParams;
  const [product, categories, operationalMeta, templates] = await Promise.all([getAdminProduct(id), getAdminCategories(), getProductOperationalMeta(id), getProductAssistTemplates(id)]);
  if (!product) notFound();
  return <>
    <AdminPageHeader eyebrow="Catalogo" title="Editar produto" description={`SKU ${product.sku} · ${product.stock} unidade(s) em estoque`} />
    {created === "1" && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <strong>Produto criado e publicado com sucesso.</strong> Agora você já pode adicionar todas as fotos de uma vez abaixo.
    </div>}
    <ProductForm product={product} categories={categories} operationalMeta={operationalMeta} templates={templates} />
    <ProductImages productId={product.id} images={product.product_images ?? []} />
  </>;
}
