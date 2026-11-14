"use client";
import { useState } from "react";
import { IdentifyOrderCustomerForm } from "./CrmWorkflowForms";
import { fieldClass, labelClass } from "./FormControls";

export function ImportedCustomerIdentification({ orders }: { orders: { id: string; number: string; name: string }[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const matches = orders.filter(order => `${order.number} ${order.name}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  const order = orders.find(order => order.id === selected);
  return <details className="mt-5 rounded-2xl border border-ink-100 bg-white p-5 shadow-card"><summary className="cursor-pointer font-bold text-blue-700">Identificar compradores dos pedidos importados ({orders.length})</summary><p className="mt-3 text-sm text-ink-500">Escolha uma compra individual e informe os dados reais do comprador. Lançamentos que agrupam vendas de várias pessoas devem permanecer sem identificação.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className={labelClass}>Buscar pedido ou nome<input value={query} onChange={event => setQuery(event.target.value)} className={fieldClass} /></label><label className={labelClass}>Pedido sem identificação<select value={selected} onChange={event => setSelected(event.target.value)} className={fieldClass}><option value="">Selecione um pedido</option>{matches.slice(0, 100).map(item => <option key={item.id} value={item.id}>{item.number} · {item.name}</option>)}</select></label></div>{matches.length > 100 && <p className="mt-2 text-xs text-ink-500">Digite parte do pedido para restringir os {matches.length} resultados.</p>}{selected && !order && <p role="status" className="mt-3 text-sm text-green-700">Identificação concluída. O pedido já não está entre os não identificados.</p>}{order && <IdentifyOrderCustomerForm key={order.id} id={order.id} name={order.name} />}</details>;
}
