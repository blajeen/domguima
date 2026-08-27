import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { InventorySpreadsheet } from "@/components/admin/InventorySpreadsheet";
import { getAdminProducts, getInventoryMovements } from "@/lib/admin/data";
import type { InventorySheetMovement, InventorySheetProduct } from "@/lib/admin/types";

export default async function InventoryPage() {
  const [products, movements] = await Promise.all([getAdminProducts(), getInventoryMovements(200)]);
  const sheetProducts: InventorySheetProduct[] = products.map((product) => {
    const image = [...(product.product_images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
    return {
      id: product.id, name: product.name, sku: product.sku, price_cents: product.price_cents,
      old_price_cents: product.old_price_cents, installment_count: product.card_installment?.count ?? null,
      installment_value_cents: product.card_installment?.value ?? null,
      stock: product.stock, low_stock_threshold: product.low_stock_threshold, status: product.status,
      category_name: product.categories?.name ?? product.category_id, image_src: image?.src ?? null,
      image_alt: image?.alt ?? product.name, updated_at: product.updated_at,
    };
  });
  const sheetMovements: InventorySheetMovement[] = movements.map((movement) => ({
    id: String(movement.id), product_id: String(movement.product_id),
    product_name: (movement.products as { name?: string } | undefined)?.name ?? String(movement.product_id),
    quantity_delta: Number(movement.quantity_delta), stock_before: Number(movement.stock_before),
    stock_after: Number(movement.stock_after), reason: String(movement.reason),
    note: movement.note ? String(movement.note) : null, created_at: String(movement.created_at),
  }));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todayUnits = sheetMovements.filter((movement) => movement.reason === "sale" && localDay(movement.created_at) === today).reduce((total, movement) => total + Math.abs(movement.quantity_delta), 0);

  return <>
    <AdminPageHeader eyebrow="Operação de estoque" title="Estoque" description="Uma visão rápida para conferir preços, corrigir quantidades e registrar as saídas do dia com segurança." />
    <PanelCard className="!p-0"><InventorySpreadsheet products={sheetProducts} movements={sheetMovements} todayUnits={todayUnits} /></PanelCard>
  </>;
}

function localDay(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
