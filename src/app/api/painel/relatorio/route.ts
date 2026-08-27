import { getOwner } from "@/lib/admin/auth";
import { readCatalogState } from "@/lib/admin/catalog-store";
import { defaultReportRange, ordersReportCsv, reportOrders, validDateParam } from "@/lib/admin/reports";

export async function GET(request: Request) {
  if (!(await getOwner())) return new Response("Não autorizado.", { status: 401 });
  const url = new URL(request.url);
  const fallback = defaultReportRange();
  const from = validDateParam(url.searchParams.get("de"), fallback.from);
  const to = validDateParam(url.searchParams.get("ate"), fallback.to);
  const sellerId = url.searchParams.get("vendedor") ?? "";
  const rawStatus = url.searchParams.get("status");
  const status = rawStatus === "cancelled" ? "cancelled" : rawStatus === "all" ? "all" : "completed";
  const orders = reportOrders(await readCatalogState(), { from, to, sellerId, status });
  const filename = `dom-guima-vendas-${from}-a-${to}.csv`;
  return new Response(ordersReportCsv(orders), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
