import type { SalesOrderRecord } from "./types";

export interface BusinessSettings {
  monthlyTargets: Record<string, number>;
  campaignBudgets: Record<string, { campaign: string; from: string; to: string; cents: number }>;
  orderCosts: Record<string, { items: Record<string, number>; feesCents: number; shippingCents: number }>;
}

export function emptyBusinessSettings(): BusinessSettings {
  return { monthlyTargets: {}, campaignBudgets: {}, orderCosts: {} };
}

export function validMoney(cents: unknown): cents is number {
  return typeof cents === "number" && Number.isSafeInteger(cents) && cents >= 0 && cents <= 100_000_000_000;
}

/** Missing historical costs remain unknown; current catalog costs never rewrite history. */
export function marginSummary(orders: SalesOrderRecord[], settings?: BusinessSettings) {
  const groups = { products: new Map<string, MarginGroup>(), sellers: new Map<string, MarginGroup>(), channels: new Map<string, MarginGroup>() };
  let salesCents = 0, coveredSalesCents = 0, costCents = 0, marginCents = 0, knownUnits = 0, totalUnits = 0;
  for (const order of orders.filter(row => row.status === "completed")) {
    const extra = settings?.orderCosts?.[order.id];
    const fees = (extra?.feesCents ?? 0) + (extra?.shippingCents ?? 0);
    let allocatedRevenue = 0;
    order.items.forEach((item, index) => {
      salesCents += item.line_total_cents;
      totalUnits += item.quantity;
      const cost = extra?.items?.[String(index)] ?? item.cost_unit_cents;
      const known = validMoney(cost);
      const beforeFees = order.total_cents > 0 ? Math.round(fees * allocatedRevenue / order.total_cents) : 0;
      allocatedRevenue += item.line_total_cents;
      const allocatedFees = order.total_cents > 0 ? Math.round(fees * allocatedRevenue / order.total_cents) - beforeFees : 0;
      const lineCost = known ? cost * item.quantity : 0;
      const lineMargin = item.line_total_cents - lineCost - item.commission_total_cents - allocatedFees;
      if (known) { coveredSalesCents += item.line_total_cents; costCents += lineCost; marginCents += lineMargin; knownUnits += item.quantity; }
      for (const [map, key, label] of [
        [groups.products, `${item.product_id}::${item.variant_id ?? ""}`, `${item.product_name}${item.variant ? ` · ${item.variant}` : ""}`],
        [groups.sellers, order.seller_id, order.seller_name],
        [groups.channels, order.channel || "", order.channel || "Não informado"],
      ] as const) {
        const row = map.get(key) ?? { key, label, salesCents: 0, coveredSalesCents: 0, marginCents: 0, units: 0, knownUnits: 0 };
        row.salesCents += item.line_total_cents; row.units += item.quantity;
        if (known) { row.coveredSalesCents += item.line_total_cents; row.marginCents += lineMargin; row.knownUnits += item.quantity; }
        map.set(key, row);
      }
    });
  }
  const list = (map: Map<string, MarginGroup>) => [...map.values()].sort((a, b) => b.salesCents - a.salesCents);
  return { salesCents, coveredSalesCents, costCents, marginCents, knownUnits, totalUnits, products: list(groups.products), sellers: list(groups.sellers), channels: list(groups.channels) };
}

export interface MarginGroup { key: string; label: string; salesCents: number; coveredSalesCents: number; marginCents: number; units: number; knownUnits: number }

export function campaignInvestment(settings: BusinessSettings | undefined, campaign: string, from: string, to: string) {
  // Only wholly contained expense periods: never prorate or invent daily ad spend.
  return Object.values(settings?.campaignBudgets ?? {}).filter(row => row.campaign === campaign && row.from >= from && row.to <= to).reduce((sum, row) => sum + row.cents, 0);
}
