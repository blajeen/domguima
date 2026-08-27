"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrderAction } from "@/app/painel/actions";
import { commissionForUnit } from "@/lib/admin/commission";
import type { ActionState, SellerRecord } from "@/lib/admin/types";
import { formatPrice, normalize } from "@/lib/utils/format";
import { formatDocument, formatPhone, onlyDigits } from "@/lib/utils/validators";

export interface OrderProductOption {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price_cents: number;
  category_name: string;
}

interface OrderLine extends OrderProductOption {
  quantity: number;
  unitPriceCents: number;
}

const emptyCustomer = { name: "", cpf: "", phone: "", cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" };
const fieldClass = "mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-100";
const labelClass = "block text-xs font-bold text-ink-600";

export function OrderComposer({ products, sellers }: { products: OrderProductOption[]; sellers: SellerRecord[] }) {
  const router = useRouter();
  const [sellerId, setSellerId] = useState(sellers.find((seller) => seller.active)?.id ?? "");
  const [customer, setCustomer] = useState(emptyCustomer);
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [feedback, setFeedback] = useState<ActionState>({});
  const [cepStatus, setCepStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const matches = useMemo(() => {
    const term = normalize(query);
    if (!term) return [];
    return products.filter((product) => product.stock > 0 && normalize(`${product.name} ${product.sku} ${product.category_name}`).includes(term) && !lines.some((line) => line.id === product.id)).slice(0, 8);
  }, [lines, products, query]);

  const gross = lines.reduce((sum, line) => sum + line.price_cents * line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const discount = Math.max(0, gross - total);
  const commission = lines.reduce((sum, line) => sum + commissionForUnit(line.unitPriceCents) * line.quantity, 0);
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);

  function updateCustomer(key: keyof typeof emptyCustomer, value: string) {
    setCustomer((current) => ({ ...current, [key]: value }));
    setFeedback({});
  }

  function addProduct(product: OrderProductOption) {
    setLines((current) => [...current, { ...product, quantity: 1, unitPriceCents: product.price_cents }]);
    setQuery("");
  }

  function changeLine(id: string, change: Partial<Pick<OrderLine, "quantity" | "unitPriceCents">>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...change, quantity: Math.max(1, Math.min(line.stock, change.quantity ?? line.quantity)), unitPriceCents: Math.max(1, change.unitPriceCents ?? line.unitPriceCents) } : line));
    setFeedback({});
  }

  function applyDiscount(percent: number) {
    setLines((current) => current.map((line) => ({ ...line, unitPriceCents: Math.max(1, Math.round(line.price_cents * (1 - percent / 100))) })));
  }

  async function lookupCep() {
    const cep = onlyDigits(customer.cep);
    if (cep.length !== 8) { setCepStatus("Informe os 8 dígitos do CEP."); return; }
    setCepStatus("Buscando endereço...");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error("CEP indisponível");
      const data = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (data.erro) { setCepStatus("CEP não encontrado. Preencha o endereço manualmente."); return; }
      setCustomer((current) => ({ ...current, cep: formatCep(cep), street: data.logradouro ?? current.street, neighborhood: data.bairro ?? current.neighborhood, city: data.localidade ?? current.city, state: data.uf ?? current.state }));
      setCepStatus("Endereço preenchido. Informe o número da casa.");
    } catch {
      setCepStatus("Não foi possível consultar agora. Você pode preencher manualmente.");
    }
  }

  function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lines.length) { setFeedback({ message: "Adicione pelo menos um produto." }); return; }
    const requestId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `order-${Date.now()}`;
    setFeedback({});
    startTransition(async () => {
      const result = await createOrderAction({
        requestId,
        sellerId,
        customer: { ...customer, cpf: onlyDigits(customer.cpf), phone: onlyDigits(customer.phone), cep: onlyDigits(customer.cep) },
        notes,
        items: lines.map((line) => ({ productId: line.id, quantity: line.quantity, expectedStock: line.stock, unitPriceCents: line.unitPriceCents })),
      });
      setFeedback(result);
      if (result.ok && result.orderId) router.push(`/painel/pedidos?criado=${encodeURIComponent(result.orderId)}`);
    });
  }

  return <form onSubmit={submitOrder} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
    <div className="space-y-6">
      <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black">Cliente e entrega</h2><p className="mt-1 text-xs text-ink-500">Os dados ficam registrados como estavam no momento da venda.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">CEP com preenchimento automático</span></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={`${labelClass} sm:col-span-2`}>Nome completo<input required value={customer.name} onChange={(event) => updateCustomer("name", event.target.value)} className={fieldClass} /></label>
          <label className={labelClass}>CPF<input required inputMode="numeric" value={customer.cpf} onChange={(event) => updateCustomer("cpf", formatDocument(event.target.value))} placeholder="000.000.000-00" className={fieldClass} /></label>
          <label className={labelClass}>Telefone <span className="font-normal text-ink-400">(opcional)</span><input inputMode="tel" value={customer.phone} onChange={(event) => updateCustomer("phone", formatPhone(event.target.value))} className={fieldClass} /></label>
          <label className={labelClass}>CEP<div className="mt-1.5 flex gap-2"><input required inputMode="numeric" value={customer.cep} onChange={(event) => updateCustomer("cep", formatCep(event.target.value))} onBlur={() => { if (onlyDigits(customer.cep).length === 8 && !customer.street) void lookupCep(); }} placeholder="00000-000" className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-100" /><button type="button" onClick={() => void lookupCep()} className="rounded-lg border border-ink-200 px-3 text-xs font-bold hover:border-gold-400">Buscar</button></div>{cepStatus && <span className="mt-1 block font-normal text-ink-500">{cepStatus}</span>}</label>
          <label className={`${labelClass} sm:col-span-2`}>Endereço<input required value={customer.street} onChange={(event) => updateCustomer("street", event.target.value)} className={fieldClass} /></label>
          <label className={labelClass}>Número<input required value={customer.number} onChange={(event) => updateCustomer("number", event.target.value)} className={fieldClass} /></label>
          <label className={labelClass}>Complemento<input value={customer.complement} onChange={(event) => updateCustomer("complement", event.target.value)} className={fieldClass} /></label>
          <label className={labelClass}>Bairro<input required value={customer.neighborhood} onChange={(event) => updateCustomer("neighborhood", event.target.value)} className={fieldClass} /></label>
          <label className={labelClass}>Cidade<input required value={customer.city} onChange={(event) => updateCustomer("city", event.target.value)} className={fieldClass} /></label>
          <label className={labelClass}>Estado<input required maxLength={2} value={customer.state} onChange={(event) => updateCustomer("state", event.target.value.toUpperCase())} className={fieldClass} /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <div><h2 className="text-lg font-black">Itens do pedido</h2><p className="mt-1 text-xs text-ink-500">Busque pelo nome ou SKU. O preço pode ser ajustado antes de finalizar.</p></div>
        <div className="relative mt-5"><label className={labelClass}>Adicionar produto<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: ferro, Starlink ou SKU" className={fieldClass} /></label>{query && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xl">{matches.map((product) => <button key={product.id} type="button" onClick={() => addProduct(product)} className="flex w-full items-center justify-between gap-4 border-b border-ink-100 px-4 py-3 text-left last:border-0 hover:bg-gold-50"><span><strong className="block text-sm">{product.name}</strong><small className="text-ink-500">SKU {product.sku} · {product.stock} em estoque</small></span><b className="shrink-0 text-sm">{formatPrice(product.price_cents)}</b></button>)}{!matches.length && <p className="px-4 py-5 text-center text-sm text-ink-500">Nenhum produto disponível encontrado.</p>}</div>}</div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-[11px] uppercase tracking-wide text-ink-400"><tr><th className="py-2">Produto</th><th>Estoque</th><th>Quantidade</th><th>Preço tabela</th><th>Preço aplicado</th><th>Total</th><th /></tr></thead><tbody className="divide-y divide-ink-100">{lines.map((line) => <tr key={line.id}><td className="py-3"><strong className="block">{line.name}</strong><small className="text-ink-400">SKU {line.sku}</small></td><td>{line.stock}</td><td><div className="inline-flex overflow-hidden rounded-lg border border-ink-200"><button type="button" onClick={() => changeLine(line.id, { quantity: line.quantity - 1 })} className="h-9 w-9 font-bold">−</button><input type="number" min={1} max={line.stock} value={line.quantity} onChange={(event) => changeLine(line.id, { quantity: Number(event.target.value) })} className="h-9 w-12 border-x border-ink-200 text-center font-bold outline-none" /><button type="button" onClick={() => changeLine(line.id, { quantity: line.quantity + 1 })} className="h-9 w-9 font-bold">+</button></div></td><td>{formatPrice(line.price_cents)}</td><td><div className="flex items-center rounded-lg border border-ink-200 px-2"><span className="text-xs text-ink-400">R$</span><input type="number" min="0.01" step="0.01" value={(line.unitPriceCents / 100).toFixed(2)} onChange={(event) => changeLine(line.id, { unitPriceCents: Math.round(Number(event.target.value) * 100) })} className="h-9 w-24 px-2 font-bold outline-none" /></div></td><td className="font-black">{formatPrice(line.unitPriceCents * line.quantity)}</td><td><button type="button" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} className="text-xs font-bold text-red-600">Remover</button></td></tr>)}</tbody></table>{!lines.length && <div className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-500">Pesquise um produto acima para começar o pedido.</div>}</div>
      </section>
    </div>

    <aside className="h-fit space-y-5 xl:sticky xl:top-8">
      <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card"><h2 className="text-lg font-black">Fechamento</h2><label className={`${labelClass} mt-4`}>Vendedor<select required value={sellerId} onChange={(event) => setSellerId(event.target.value)} className={fieldClass}><option value="">Selecione</option>{sellers.filter((seller) => seller.active).map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}</select></label><div className="mt-5"><p className="text-xs font-bold text-ink-500">Desconto rápido</p><div className="mt-2 grid grid-cols-4 gap-2">{[0, 5, 10, 15].map((percent) => <button key={percent} type="button" onClick={() => applyDiscount(percent)} className="rounded-lg border border-ink-200 py-2 text-xs font-black hover:border-gold-400 hover:bg-gold-50">{percent}%</button>)}</div></div><label className={`${labelClass} mt-5`}>Observações<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={fieldClass} placeholder="Pagamento, entrega ou condição combinada" /></label><dl className="mt-5 space-y-2 border-t border-ink-100 pt-4 text-sm"><Summary label="Produtos" value={`${units} unidade(s)`} /><Summary label="Valor de tabela" value={formatPrice(gross)} /><Summary label="Desconto" value={`− ${formatPrice(discount)}`} muted={!discount} /><div className="flex items-end justify-between border-t border-ink-100 pt-3"><dt className="font-bold">Total do pedido</dt><dd className="text-2xl font-black">{formatPrice(total)}</dd></div></dl><div className="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-800"><strong>Comissão calculada: {formatPrice(commission)}</strong><p className="mt-1 leading-relaxed">A comissão usa o preço final de cada unidade e fica congelada no pedido.</p></div>{feedback.message && <p role="alert" className={`mt-4 rounded-lg px-3 py-2 text-sm ${feedback.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{feedback.message}</p>}<button type="submit" disabled={isPending || !lines.length} className="mt-5 w-full rounded-xl bg-ink-900 px-4 py-3.5 text-sm font-black text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50">{isPending ? "Finalizando pedido..." : "Finalizar pedido e baixar estoque"}</button><p className="mt-2 text-center text-[11px] leading-relaxed text-ink-400">A baixa acontece somente após a confirmação deste botão.</p></section>
      <CommissionTable />
    </aside>
  </form>;
}

function Summary({ label, value, muted }: { label: string; value: string; muted?: boolean }) { return <div className="flex justify-between gap-3"><dt className="text-ink-500">{label}</dt><dd className={`font-bold ${muted ? "text-ink-300" : ""}`}>{value}</dd></div>; }
function CommissionTable() { return <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card"><h3 className="text-sm font-black">Tabela de comissão</h3><div className="mt-3 space-y-2 text-xs text-ink-600"><Summary label="Até R$ 25" value="R$ 1/un." /><Summary label="R$ 25,01 a R$ 100" value="R$ 2,50/un." /><Summary label="R$ 100,01 a R$ 250" value="R$ 5/un." /><Summary label="R$ 250,01 a R$ 1.000" value="R$ 10/un." /><Summary label="Acima de R$ 1.000" value="1%" /></div></section>; }
function formatCep(value: string) { return onlyDigits(value).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2"); }
