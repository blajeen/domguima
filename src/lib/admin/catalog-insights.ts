import type { AdminProductRow, ProductOperationalMeta, SalesOrderRecord } from "./types";

export function incompleteProduct(product: AdminProductRow): boolean {
  return !product.name.trim() || !product.sku.trim() || product.price_cents <= 0 || !product.description.trim() || !product.product_images?.length;
}

export function missingProductCost(product: AdminProductRow, meta?: ProductOperationalMeta): boolean {
  const variants = product.product_variants?.filter(variant => variant.active) ?? [];
  return variants.length ? variants.some(variant => !(Number(meta?.variant_prices?.[variant.id]?.cost_cents) > 0)) : !(Number(meta?.cost_cents) > 0);
}

/** Rolling 30 local calendar days, including today. Pending/cancelled never count. */
export function recentUnits(orders: readonly SalesOrderRecord[], now = new Date()): Map<string, number> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const end = new Date(`${today}T12:00:00-03:00`);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 29);
  const first = start.toISOString().slice(0, 10);
  const units = new Map<string, number>();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  for (const order of orders) {
    const created = new Date(order.created_at);
    if (order.status !== "completed" || !Number.isFinite(created.getTime()) || created > now) continue;
    const date = day.format(created);
    if (date < first || date > today) continue;
    for (const item of order.items) {
      if (!(item.quantity > 0)) continue;
      units.set(item.product_id, (units.get(item.product_id) ?? 0) + item.quantity);
      if (item.variant_id) {
        const key = `${item.product_id}::${item.variant_id}`;
        units.set(key, (units.get(key) ?? 0) + item.quantity);
      }
    }
  }
  return units;
}

export function stockCoverage(stock: number, units30: number) {
  return units30 > 0 ? { days: stock / (units30 / 30), replenish: Math.max(0, Math.ceil(units30 - stock)) } : null;
}
