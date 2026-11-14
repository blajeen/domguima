"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import type { BusinessDashboardData } from "@/lib/admin/dashboard-period";
import { formatPrice } from "@/lib/utils/format";
import { MonthlyTargetForm } from "./BusinessForms";

const tabs = [{ key: "sales", label: "Vendas" }, { key: "operations", label: "Operação" }, { key: "channels", label: "Canais" }] as const;
type Tab = typeof tabs[number]["key"];
const shortMoney = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);

export function BusinessDashboard({ data }: { data: BusinessDashboardData }) {
  const [active, setActive] = useState<Tab>("sales");
  const id = useId(), buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const totals = data.totals;
  const percentage = data.previousSalesCents > 0 ? (data.comparisonSalesCents - data.previousSalesCents) / data.previousSalesCents * 100 : null;
  const report = `/painel/financeiro?de=${data.from}&ate=${data.to}`;
  return <section className="business-dashboard" aria-labelledby={`${id}-heading`}>
    <div className="business-heading">
      <div><p className="business-kicker">Como anda o negócio</p><h2 id={`${id}-heading`}>Resultado do mês</h2><p className="business-period">{data.monthLabel} · dia 1 a {data.elapsedDays}</p></div>
      <Link href={report} className="business-report-link">Ver relatório <span aria-hidden="true">↗</span></Link>
    </div>
    <div className="business-tabs" role="tablist" aria-label="Gráficos do negócio">
      {tabs.map((tab, index) => <button key={tab.key} ref={element => { buttons.current[index] = element; }} type="button" role="tab" id={`${id}-${tab.key}-tab`} aria-controls={`${id}-${tab.key}-panel`} aria-selected={active === tab.key} tabIndex={active === tab.key ? 0 : -1} onClick={() => setActive(tab.key)} onKeyDown={event => {
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : null;
        if (next !== null) { event.preventDefault(); setActive(tabs[next].key); buttons.current[next]?.focus(); }
      }}>{tab.label}</button>)}
    </div>

    <div role="tabpanel" id={`${id}-sales-panel`} aria-labelledby={`${id}-sales-tab`} hidden={active !== "sales"} tabIndex={0}>
      <div className="business-sales-head">
        <div><p className="business-label">Faturamento de pedidos finalizados</p><p className="business-revenue">{formatPrice(totals.salesCents)}</p></div>
        <div className="business-comparison"><span className={percentage === null ? "business-change neutral" : percentage >= 0 ? "business-change positive" : "business-change negative"}>{percentage === null ? "Sem base anterior" : `${percentage > 0 ? "+" : ""}${percentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}</span><span>vs. {data.previousMonthLabel}<br />dias 1–{data.comparisonDay} nos dois meses</span></div>
      </div>
      <div className="business-metrics">
        <Metric label="Pedidos finalizados" value={String(totals.orders)} />
        <Metric label="Ticket médio" value={formatPrice(totals.orders ? Math.round(totals.salesCents / totals.orders) : 0)} />
        <Metric label="Itens vendidos" value={String(totals.units)} />
      </div>
      <details className="business-goal"><summary>{data.monthlyTargetCents ? `Meta do mês: ${formatPrice(data.monthlyTargetCents)} · ${(totals.salesCents / data.monthlyTargetCents * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% atingida` : "Definir meta do mês"}</summary><MonthlyTargetForm month={data.from.slice(0,7)} cents={data.monthlyTargetCents ?? 0} /></details>
      {!!data.monthlyTargetCents && <progress className="business-goal-progress" max={data.monthlyTargetCents} value={Math.min(totals.salesCents, data.monthlyTargetCents)} aria-label="Progresso da meta mensal" />}
      <SalesChart data={data} />
      <p className="business-footnote">Valores acumulados por data do pedido. Pendentes e cancelados ficam fora do faturamento.</p>
    </div>

    <div role="tabpanel" id={`${id}-operations-panel`} aria-labelledby={`${id}-operations-tab`} hidden={active !== "operations"} tabIndex={0}>
      <Operations data={data} />
    </div>

    <div role="tabpanel" id={`${id}-channels-panel`} aria-labelledby={`${id}-channels-tab`} hidden={active !== "channels"} tabIndex={0}>
      <div className="business-chart-heading"><h3>De onde vêm as vendas</h3><p>Faturamento por canal · pedidos finalizados</p></div>
      {!data.channels.length ? <div className="business-empty">Nenhuma venda finalizada neste mês. Os canais aparecem aqui após o primeiro pedido finalizado.</div> : <div className="business-bars">{data.channels.map((channel, index) => {
        const share = totals.salesCents > 0 ? channel.salesCents / totals.salesCents : 0;
        return <div className="business-bar-row" key={channel.key}><div><strong>{channel.label}</strong><span>{formatPrice(channel.salesCents)}</span></div><div className="business-track"><span style={{ width: `${share * 100}%`, background: index === 0 ? "var(--color-gold-500)" : "var(--color-ink-500)" }} /></div><p>{channel.orders} pedido(s) · {(share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do faturamento</p></div>;
      })}</div>}
      <p className="business-footnote">Pedidos sem canal cadastrado permanecem em “Não informado”.</p>
    </div>
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p>{label}</p><strong>{value}</strong></div>;
}

function SalesChart({ data }: { data: BusinessDashboardData }) {
  const [selected, setSelected] = useState(data.series.length - 1);
  const uid = useId();
  const width = 560, height = 155, left = 52, top = 14, right = 12, bottom = 24;
  const max = Math.max(100, ...data.series.flatMap(point => [point.salesCents, point.previousCents ?? 0]));
  const x = (index: number) => left + (data.series.length === 1 ? (width - left - right) / 2 : index / (data.series.length - 1) * (width - left - right));
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  const current = data.series.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.salesCents)}`).join(" ");
  const previous = data.series.flatMap((point, index) => point.previousCents === null ? [] : [`${index ? "L" : "M"}${x(index)},${y(point.previousCents)}`]).join(" ");
  const point = data.series[selected] ?? data.series[0];
  const empty = data.totals.orders === 0 && data.previousSalesCents === 0;
  return <div className="business-line-chart">
    <div className="business-chart-heading"><h3>Faturamento acumulado</h3><div className="business-legend"><span><i />Mês atual</span><span><i className="previous" />Mês anterior</span></div></div>
    {empty && <p className="business-chart-empty">Nenhuma venda finalizada nos períodos comparados.</p>}
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Faturamento acumulado de ${data.monthLabel}: ${formatPrice(data.totals.salesCents)}. Comparação com ${data.previousMonthLabel} até o dia ${data.comparisonDay}.`}>
      <defs><linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-gold-400)" stopOpacity=".23" /><stop offset="100%" stopColor="var(--color-gold-400)" stopOpacity=".01" /></linearGradient></defs>
      {[0, .5, 1].map(factor => <g key={factor}><line x1={left} x2={width - right} y1={y(max * factor)} y2={y(max * factor)} stroke="var(--color-ink-100)" /><text x={left - 8} y={y(max * factor) + 3} textAnchor="end" className="business-axis">{shortMoney(max * factor)}</text></g>)}
      <path d={`${current} L${x(data.series.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${uid}-area)`} />
      <path d={previous} fill="none" stroke="var(--color-ink-400)" strokeWidth="2" strokeDasharray="5 5" />
      <path d={current} fill="none" stroke="var(--color-gold-600)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {[0, Math.floor((data.series.length - 1) / 2), data.series.length - 1].filter((value, index, list) => list.indexOf(value) === index).map(index => <text key={index} x={x(index)} y={height - 4} textAnchor="middle" className="business-axis">{data.series[index].label}</text>)}
      {data.series.map((row, index) => <circle key={row.day} cx={x(index)} cy={y(row.salesCents)} r={selected === index ? 4 : 2} fill="var(--color-gold-600)" onMouseEnter={() => setSelected(index)}><title>{`${row.label}: ${formatPrice(row.salesCents)}`}</title></circle>)}
    </svg>
    <div className="business-point-detail"><span>Até {point.label}</span><strong>{formatPrice(point.salesCents)}</strong><span>Anterior: {point.previousCents === null ? "—" : formatPrice(point.previousCents)}</span></div>
    <label className="business-chart-slider">Consultar dia <input type="range" min={0} max={data.series.length - 1} disabled={data.series.length === 1} value={selected} onChange={event => setSelected(Number(event.target.value))} aria-label="Dia do gráfico de faturamento" /></label>
  </div>;
}

function Operations({ data }: { data: BusinessDashboardData }) {
  const total = data.statuses.completed + data.statuses.pending + data.statuses.cancelled;
  const rows = [{ label: "Finalizados", count: data.statuses.completed, color: "var(--color-success)" }, { label: "Aguardando confirmação", count: data.statuses.pending, color: "var(--color-gold-500)" }, { label: "Cancelados", count: data.statuses.cancelled, color: "#b91c1c" }];
  return <>
    <div className="business-chart-heading"><h3>Andamento dos pedidos</h3><p>{total} pedido(s) registrado(s) no mês</p></div>
    <div className="business-operation-total"><strong>{total ? Math.round(data.statuses.completed / total * 100) : 0}%</strong><span>dos pedidos do mês finalizados</span></div>
    {!total ? <div className="business-empty">Nenhum pedido registrado neste mês.</div> : <div className="business-bars">{rows.map(row => <div className="business-bar-row" key={row.label}><div><strong>{row.label}</strong><span>{row.count}</span></div><div className="business-track"><span style={{ width: `${row.count / total * 100}%`, background: row.color }} /></div></div>)}</div>}
    <div className="business-metrics business-operation-metrics"><Metric label="Descontos concedidos" value={formatPrice(data.totals.discountCents)} /><Metric label="Comissões geradas" value={formatPrice(data.totals.commissionCents)} /></div>
    <p className="business-footnote">Descontos e comissões consideram apenas pedidos finalizados.</p>
  </>;
}
