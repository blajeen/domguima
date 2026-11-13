// Monthly dashboard checks: real report rules, local dates and equivalent periods.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = mkdtempSync(path.join(tmpdir(), "dashboard-check-"));
const empty = path.join(temporary, "server-only.cjs");
writeFileSync(empty, "");
try {
  const jiti = createJiti(path.join(root, "x.js"), { alias: { "@": path.join(root, "src"), "server-only": empty } });
  const { dashboardPeriods } = await jiti.import(path.join(root, "src/lib/admin/dashboard-period.ts"));
  const { reportTotals, channelSummaries } = await jiti.import(path.join(root, "src/lib/admin/reports.ts"));
  const order = (created_at, total_cents = 10000, status = "completed", channel = "whatsapp") => ({ created_at, total_cents, status, channel, total_units: 2, gross_total_cents: total_cents + 1000, discount_total_cents: 1000, commission_total_cents: 500 });
  const now = new Date("2026-11-13T15:00:00Z");
  const orders = [order("2026-11-01T02:59:59Z"), order("2026-11-01T03:00:00Z", 20000), order("2026-11-13T15:00:00Z", 30000, "completed", ""), order("2026-11-13T16:00:00Z", 90000, "pending"), order("2026-11-13T16:00:00Z", 80000, "cancelled"), order("2026-11-14T03:00:00Z"), order("2026-10-13T03:00:00Z", 25000), order("2026-10-14T03:00:00Z"), order("invalid")];
  const result = dashboardPeriods(orders, now);
  assert.equal(result.from, "2026-11-01");
  assert.equal(result.to, "2026-11-13");
  assert.equal(result.currentOrders.length, 4, "local month boundary, future days and invalid dates excluded");
  assert.equal(result.previousOrders.length, 1, "only equivalent previous days");
  assert.equal(result.series.at(-1).salesCents, 50000, "cancelled/pending excluded from chart");
  assert.equal(result.series.at(-1).previousCents, 25000);
  assert.equal(result.series[0].salesCents, 20000);
  const totals = reportTotals(result.currentOrders);
  assert.equal(totals.salesCents, result.series.at(-1).salesCents);
  assert.equal(totals.orders, 2);
  assert.equal(totals.units, 4);
  assert.equal(totals.discountCents, 2000);
  assert.equal(totals.commissionCents, 1000);
  assert.equal(totals.cancelled, 1);
  const channels = channelSummaries(result.currentOrders);
  assert.equal(channels.reduce((sum, channel) => sum + channel.salesCents, 0), totals.salesCents);
  assert.equal(channels.find(channel => channel.key === "nao-informado").salesCents, 30000);

  const march = dashboardPeriods([order("2026-03-28T15:00:00Z"), order("2026-03-31T15:00:00Z"), order("2026-02-28T15:00:00Z", 5000)], new Date("2026-03-31T15:00:00Z"));
  assert.equal(march.comparisonDay, 28);
  assert.equal(march.currentOrders.length, 2);
  assert.equal(march.comparisonCurrentOrders.length, 1, "day31 not compared to nonexistent February day31");
  assert.equal(march.series.at(-1).previousCents, null);
  assert.equal(march.series[27].previousCents, 5000);
  assert.equal(dashboardPeriods([], new Date("2024-03-31T15:00:00Z")).comparisonDay, 29, "leap year");
  const january = dashboardPeriods([], new Date("2026-01-01T03:00:00Z"));
  assert.equal(january.comparisonFrom, "2025-12-01");
  assert.equal(january.comparisonTo, "2025-12-01");
  assert.equal(january.series.length, 1);
  assert.equal(january.series[0].salesCents, 0);
  assert.equal(january.series[0].previousCents, 0);
  const timezone = dashboardPeriods([], new Date("2026-11-01T02:00:00Z"));
  assert.equal(timezone.to, "2026-10-31", "now also follows São Paulo timezone");
  console.log("dashboard ok: dates, equivalent periods, totals, channels and empty data");
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
