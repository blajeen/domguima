import { AdminPageHeader } from "@/components/admin/AdminShell";
import { BulkOrderImporter } from "@/components/admin/BulkOrderImporter";
import { requireOwner } from "@/lib/admin/auth";
import { getAdminProducts, getSellers } from "@/lib/admin/data";

export default async function BulkImportPage() {
  await requireOwner();
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
    <AdminPageHeader
      eyebrow="Venda assistida"
      title="Lançar vendas do grupo"
      description="Cole as mensagens do controle diário. Cada lançamento vira um pedido com baixa no estoque — depois de você conferir produto por produto."
    />
    <BulkOrderImporter products={options} sellers={sellers} />
  </>;
}
