import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductImages } from "@/components/admin/ProductImages";
import { getAdminCategories, getAdminProduct } from "@/lib/admin/data";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getAdminProduct(id), getAdminCategories()]);
  if (!product) notFound();
  return <><AdminPageHeader eyebrow="Catalogo" title="Editar produto" description={`SKU ${product.sku} · ${product.stock} unidade(s) em estoque`} /><ProductForm product={product} categories={categories} /><ProductImages productId={product.id} images={product.product_images ?? []} /></>;
}
