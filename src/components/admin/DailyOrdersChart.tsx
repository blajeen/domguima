import Link from "next/link";
import type { BusinessDashboardData } from "@/lib/admin/dashboard-period";

export function DailyOrdersChart({ data }: { data: BusinessDashboardData }) {
  const points = data.series.slice(-14);
  const total = points.reduce((sum, point) => sum + point.orders, 0);
  const today = points.at(-1)!;
  const withoutOrders = points.filter(point => point.day < data.elapsedDays && point.orders === 0).length;
  const max = Math.max(1, ...points.map(point => point.orders));
  const width = 560, height = 92, left = 24, right = 12, top = 9, bottom = 20;
  const x = (index: number) => left + (points.length === 1 ? (width - left - right) / 2 : index / (points.length - 1) * (width - left - right));
  const y = (count: number) => top + (1 - count / max) * (height - top - bottom);
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.orders)}`).join(" ");
  const period = `${points[0].label} a ${today.label}`;
  return <section className="daily-orders" aria-labelledby="daily-orders-heading">
    <div className="daily-orders-heading"><div><h2 id="daily-orders-heading">Ritmo de pedidos</h2><p>Finalizados por dia · {period}</p></div><Link href={`/painel/financeiro?de=${data.from}&ate=${data.to}`}>Ver relatório ↗</Link></div>
    <div className="daily-orders-metrics"><p>Hoje <strong>{today.orders}</strong></p><p>Média/dia <strong>{(total / points.length).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</strong></p><p>Dias sem pedidos <strong>{withoutOrders}</strong></p></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Pedidos finalizados por dia, de ${period}. ${total} pedidos no período. Hoje: ${today.orders}.`}>
      {[0, max].map(value => <g key={value}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="var(--color-ink-100)" /><text x={left - 7} y={y(value) + 3} textAnchor="end" className="business-axis">{value}</text></g>)}
      <path d={path} fill="none" stroke="var(--color-ink-600)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => <circle key={point.day} cx={x(index)} cy={y(point.orders)} r={points.length === 1 || index === points.length - 1 ? 3.5 : 2.5} fill="var(--color-gold-600)"><title>{point.label}: {point.orders} pedido(s) finalizado(s)</title></circle>)}
      {[0, Math.floor((points.length - 1) / 2), points.length - 1].filter((value, index, all) => all.indexOf(value) === index).map(index => <text key={index} x={x(index)} y={height - 3} textAnchor="middle" className="business-axis">{points[index].label}</text>)}
    </svg>
    <p className="daily-orders-note">Até 14 dias do mês, pela data do pedido. Dias sem pedidos excluem hoje, ainda em andamento.</p>
    <table className="sr-only"><caption>Pedidos finalizados por dia: {period}</caption><thead><tr><th scope="col">Dia</th><th scope="col">Pedidos</th></tr></thead><tbody>{points.map(point => <tr key={point.day}><th scope="row">{point.label}</th><td>{point.orders}</td></tr>)}</tbody></table>
  </section>;
}
