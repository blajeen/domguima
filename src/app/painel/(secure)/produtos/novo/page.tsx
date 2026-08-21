import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ProductForm } from "@/components/admin/ProductForm";
import { getAdminCategories } from "@/lib/admin/data";

export default async function NewProductPage() {
  const categories = await getAdminCategories();
  return <><AdminPageHeader eyebrow="Catalogo" title="Novo produto" description="Salve primeiro como rascunho; depois adicione as fotos e publique." /><ProductForm categories={categories} /></>;
}
