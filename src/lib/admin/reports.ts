import "server-only";

import type { CatalogState } from "./catalog-store";
import type { SalesOrderRecord } from "./types";

export interface ReportFilters {
  from: string;
  to: string;
  sellerId?: string;
  status?: "pending" | "completed" | "cancelled" | "all";
}

export interface SellerReportSummary {
  sellerId: string;
  sellerName: string;
  orders: number;
  units: number;
  salesCents: number;
  commissionCents: number;
}

export function reportOrders(state: CatalogState, filters: ReportFilters): SalesOrderRecord[] {
  return state.operations.orders.filter((order) => {
    const day = localDate(order.created_at);
    return day >= filters.from && day <= filters.to
      && (!filters.sellerId || order.seller_id === filters.sellerId)
      && (!filters.status || filters.status === "all" || order.status === filters.status);
  });
}

export function sellerSummaries(orders: SalesOrderRecord[]): SellerReportSummary[] {
  const summaries = new Map<string, SellerReportSummary>();
  for (const order of orders.filter((item) => item.status === "completed")) {
    const current = summaries.get(order.seller_id) ?? { sellerId: order.seller_id, sellerName: order.seller_name, orders: 0, units: 0, salesCents: 0, commissionCents: 0 };
    current.orders += 1;
    current.units += order.total_units;
    current.salesCents += order.total_cents;
    current.commissionCents += order.commission_total_cents;
    summaries.set(order.seller_id, current);
  }
  return [...summaries.values()].sort((a, b) => b.salesCents - a.salesCents);
}

export function reportTotals(orders: SalesOrderRecord[]) {
  const completed = orders.filter((order) => order.status === "completed");
  return {
    orders: completed.length,
    units: completed.reduce((sum, order) => sum + order.total_units, 0),
    grossCents: completed.reduce((sum, order) => sum + order.gross_total_cents, 0),
    discountCents: completed.reduce((sum, order) => sum + order.discount_total_cents, 0),
    salesCents: completed.reduce((sum, order) => sum + order.total_cents, 0),
    commissionCents: completed.reduce((sum, order) => sum + order.commission_total_cents, 0),
    cancelled: orders.filter((order) => order.status === "cancelled").length,
  };
}

export function ordersReportCsv(orders: SalesOrderRecord[]): string {
  const headers = [
    "pedido", "data", "status", "vendedor", "cliente", "cpf", "cep", "endereco",
    "sku", "produto", "quantidade", "preco_tabela", "preco_vendido", "desconto",
    "total_item", "comissao_unitaria", "comissao_total",
  ];
  const rows = orders.flatMap((order) => order.items.map((item) => [
    order.number,
    localDateTime(order.created_at),
    order.status === "completed" ? "Finalizado" : order.status === "pending" ? "Aguardando confirmação" : "Cancelado",
    order.seller_name,
    order.customer.name,
    order.customer.cpf,
    order.customer.cep,
    `${order.customer.street}, ${order.customer.number}${order.customer.complement ? ` - ${order.customer.complement}` : ""} - ${order.customer.neighborhood} - ${order.customer.city}/${order.customer.state}`,
    item.sku,
    item.product_name,
    item.quantity,
    money(item.list_unit_price_cents),
    money(item.unit_price_cents),
    money(item.discount_cents),
    money(item.line_total_cents),
    money(item.commission_unit_cents),
    money(item.commission_total_cents),
  ]));
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

export function defaultReportRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-");
  return { from: `${parts[0]}-${parts[1]}-01`, to: `${parts[0]}-${parts[1]}-${parts[2]}` };
}

export function validDateParam(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function localDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function localDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function money(cents: number) { return (cents / 100).toFixed(2).replace(".", ","); }
function csvCell(value: string | number) { const text = String(value); return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
