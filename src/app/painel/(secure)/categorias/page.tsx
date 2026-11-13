import { AdminPageHeader } from "@/components/admin/AdminShell";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { recentUnits } from "@/lib/admin/catalog-insights";
import { getAdminCategories, getAdminProducts, getSalesOrders } from "@/lib/admin/data";

export default async function CategoriesPage() {
  const [categories, products, orders] = await Promise.all([getAdminCategories(), getAdminProducts(), getSalesOrders()]);
  const units = recentUnits(orders);
  return <>
    <AdminPageHeader eyebrow="Organizacao" title="Categorias" description="Controle nome, endereco, ordem e visibilidade no menu. Categorias com produtos devem ser desativadas, nao apagadas." />
    <div className="space-y-3">{categories.map((category) => { const items = products.filter(product => product.category_id === category.id); return <section key={category.id}><p className="mb-2 text-xs text-ink-500"><strong>{category.name}</strong> · {items.filter(item => item.status === "active" && item.stock > 0).length} produto(s) disponível(is) · {items.reduce((sum,item) => sum + (units.get(item.id) ?? 0), 0)} unidade(s) vendida(s) nos últimos 30 dias</p><CategoryForm category={category} /></section>; })}</div>
    <div className="mt-7"><h2 className="mb-3 text-lg font-black">Nova categoria</h2><CategoryForm /></div>
  </>;
}
