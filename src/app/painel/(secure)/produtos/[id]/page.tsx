import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductImages } from "@/components/admin/ProductImages";
import { requireOwner } from "@/lib/admin/auth";
import { getAdminCategories, getAdminProduct, getProductAssistTemplates, getProductOperationalMeta } from "@/lib/admin/data";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  const [product, categories, operationalMeta, templates] = await Promise.all([getAdminProduct(id), getAdminCategories(), getProductOperationalMeta(id), getProductAssistTemplates(id)]);
  if (!product) notFound();
  return <><AdminPageHeader eyebrow="Catalogo" title="Editar produto" description={`SKU ${product.sku} · ${product.stock} unidade(s) em estoque`} /><ProductForm product={product} categories={categories} operationalMeta={operationalMeta} templates={templates} /><ProductImages productId={product.id} images={product.product_images ?? []} /></>;
}
