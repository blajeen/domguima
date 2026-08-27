import { AdminPageHeader } from "@/components/admin/AdminShell";
import { OrderComposer } from "@/components/admin/OrderComposer";
import { getAdminProducts, getSellers } from "@/lib/admin/data";

export default async function NewOrderPage() {
  const [products, sellers] = await Promise.all([getAdminProducts(), getSellers()]);
  const options = products.filter((product) => product.status !== "archived").map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    stock: product.stock,
    price_cents: product.price_cents,
    category_name: product.categories?.name ?? product.category_id,
  }));
  return <>
    <AdminPageHeader eyebrow="Venda assistida" title="Novo pedido" description="Cadastre o cliente, selecione o vendedor e finalize a venda com baixa automática no estoque." />
    <OrderComposer products={options} sellers={sellers} />
  </>;
}
