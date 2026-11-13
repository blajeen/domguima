import type { SalesOrderRecord } from "./types";

const shopDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
const monthName = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });
const pad = (value: number) => String(value).padStart(2, "0");
const date = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

export interface BusinessDashboardData {
  from: string;
  to: string;
  monthLabel: string;
  previousMonthLabel: string;
  comparisonDay: number;
  elapsedDays: number;
  comparisonFrom: string;
  comparisonTo: string;
  series: { day: number; label: string; orders: number; salesCents: number; previousCents: number | null }[];
  totals: { orders: number; units: number; salesCents: number; discountCents: number; commissionCents: number };
  comparisonSalesCents: number;
  previousSalesCents: number;
  statuses: { completed: number; pending: number; cancelled: number };
  channels: { key: string; label: string; orders: number; units: number; salesCents: number }[];
}

/** Pure period selection. Dates follow the same creation-date rule as Reports. */
export function dashboardPeriods(orders: readonly SalesOrderRecord[], now = new Date()) {
  const parts = Object.fromEntries(shopDate.formatToParts(now).map(part => [part.type, part.value]));
  const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
  const prior = new Date(Date.UTC(year, month - 2, 1));
  const previousYear = prior.getUTCFullYear(), previousMonth = prior.getUTCMonth() + 1;
  const previousLastDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const comparisonDay = Math.min(day, previousLastDay);
  const from = date(year, month, 1), to = date(year, month, day);
  const comparisonFrom = date(previousYear, previousMonth, 1), comparisonTo = date(previousYear, previousMonth, comparisonDay);
  const comparisonCurrentTo = date(year, month, comparisonDay);
  const dated = orders.flatMap(order => {
    const timestamp = new Date(order.created_at);
    return Number.isFinite(timestamp.getTime()) ? [{ order, day: shopDate.format(timestamp) }] : [];
  });
  const current = dated.filter(item => item.day >= from && item.day <= to);
  const previous = dated.filter(item => item.day >= comparisonFrom && item.day <= comparisonTo);
  const daily = (rows: typeof dated) => {
    const result = new Map<number, number>();
    for (const item of rows) if (item.order.status === "completed") {
      const number = Number(item.day.slice(-2));
      result.set(number, (result.get(number) ?? 0) + item.order.total_cents);
    }
    return result;
  };
  const dailyCurrent = daily(current), dailyPrevious = daily(previous);
  const dailyOrders = new Map<number, number>();
  for (const item of current) if (item.order.status === "completed") {
    const number = Number(item.day.slice(-2));
    dailyOrders.set(number, (dailyOrders.get(number) ?? 0) + 1);
  }
  let cumulative = 0, priorCumulative = 0;
  const series = Array.from({ length: day }, (_, index) => {
    const number = index + 1;
    cumulative += dailyCurrent.get(number) ?? 0;
    priorCumulative += dailyPrevious.get(number) ?? 0;
    return { day: number, label: `${pad(number)}/${pad(month)}`, orders: dailyOrders.get(number) ?? 0, salesCents: cumulative, previousCents: number <= comparisonDay ? priorCumulative : null };
  });
  return {
    from, to, comparisonFrom, comparisonTo, comparisonDay, elapsedDays: day,
    monthLabel: monthName.format(new Date(Date.UTC(year, month - 1, 15))),
    previousMonthLabel: monthName.format(prior),
    series,
    currentOrders: current.map(item => item.order),
    previousOrders: previous.map(item => item.order),
    comparisonCurrentOrders: current.filter(item => item.day <= comparisonCurrentTo).map(item => item.order),
  };
}
