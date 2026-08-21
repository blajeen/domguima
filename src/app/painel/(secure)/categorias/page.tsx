import { AdminPageHeader } from "@/components/admin/AdminShell";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { getAdminCategories } from "@/lib/admin/data";

export default async function CategoriesPage() {
  const categories = await getAdminCategories();
  return <>
    <AdminPageHeader eyebrow="Organizacao" title="Categorias" description="Controle nome, endereco, ordem e visibilidade no menu. Categorias com produtos devem ser desativadas, nao apagadas." />
    <div className="space-y-3">{categories.map((category) => <CategoryForm key={category.id} category={category} />)}</div>
    <div className="mt-7"><h2 className="mb-3 text-lg font-black">Nova categoria</h2><CategoryForm /></div>
  </>;
}
