import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { OrderComposer } from "@/components/admin/OrderComposer";
import { requireOwner } from "@/lib/admin/auth";
import { getAdminProducts, getSellers } from "@/lib/admin/data";

export default async function NewOrderPage() {
  await requireOwner();
  const [products, sellers] = await Promise.all([getAdminProducts(), getSellers()]);
  const options = products.filter((product) => product.status !== "archived").map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    stock: product.stock,
    price_cents: product.price_cents,
    category_name: product.categories?.name ?? product.category_id,
    variants: (product.product_variants ?? []).filter((linha) => linha.active)
      .map((linha) => ({ id: linha.id, label: linha.label, sku: linha.sku, stock: linha.stock, price_cents: linha.price_cents })),
  }));
  return <>
    <AdminPageHeader
      eyebrow="Venda assistida"
      title="Novo pedido"
      description="Cadastre o cliente, selecione o vendedor e finalize a venda com baixa automática no estoque."
      actions={<Link href="/painel/pedidos/importar" className="rounded-lg border border-ink-300 bg-white px-4 py-2.5 text-sm font-extrabold text-ink-800">Lançar do grupo</Link>}
    />
    <OrderComposer products={options} sellers={sellers} />
  </>;
}
