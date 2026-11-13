"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrice } from "@/lib/utils/format";
import { comparisonGroup } from "@/lib/catalog/comparison";

export interface ComparisonProduct {
  id: string; name: string; slug: string; categoryId: string; price: number; brand: string; stock: number;
  specs: { label: string; value: string }[];
}

/** Only public, minimal product fields cross the client boundary. */
export function ProductComparison({ products }: { products: ComparisonProduct[] }) {
  const comparable = products.filter(product => { const group = comparisonGroup(product.name, product.categoryId); return group && products.some(other => other.id !== product.id && comparisonGroup(other.name, other.categoryId) === group); });
  const [firstId, setFirst] = useState(comparable[0]?.id ?? "");
  const first = comparable.find(product => product.id === firstId) ?? comparable[0];
  const alternatives = first ? comparable.filter(product => comparisonGroup(product.name, product.categoryId) === comparisonGroup(first.name, first.categoryId) && product.id !== first.id) : [];
  const [secondId, setSecond] = useState(alternatives[0]?.id ?? "");
  const second = alternatives.find(product => product.id === secondId) ?? alternatives[0];
  if (!first || !second) return null;
  const labels = [...new Set([first,second].flatMap(product => product.specs.map(spec => spec.label)))].slice(0,12);
  return <details className="mt-5 rounded-card border border-fio bg-white p-4"><summary className="cursor-pointer text-sm font-bold text-grafite-900">Comparar produtos desta lista</summary><p className="mt-2 text-xs text-ink-500">Escolha dois produtos da mesma categoria e confira as diferenças antes de comprar.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Primeiro produto<select value={first.id} onChange={event => setFirst(event.target.value)} className="mt-1 block w-full rounded-control border border-fio bg-white p-2.5 text-sm">{comparable.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label className="text-xs font-bold">Comparar com<select value={second.id} onChange={event => setSecond(event.target.value)} className="mt-1 block w-full rounded-control border border-fio bg-white p-2.5 text-sm">{alternatives.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><caption className="sr-only">Comparação entre {first.name} e {second.name}</caption><thead><tr><th scope="col" className="p-2">Característica</th>{[first,second].map(product => <th key={product.id} scope="col" className="w-2/5 p-2"><Link href={`/produto/${product.slug}`} className="text-grafite-900 underline">{product.name}</Link></th>)}</tr></thead><tbody className="divide-y divide-fio"><tr><th scope="row" className="p-2">Preço à vista</th>{[first,second].map(product => <td key={product.id} className="p-2 font-bold">{formatPrice(product.price)}</td>)}</tr><tr><th scope="row" className="p-2">Marca</th>{[first,second].map(product => <td key={product.id} className="p-2">{product.brand || "Não informada"}</td>)}</tr><tr><th scope="row" className="p-2">Disponibilidade</th>{[first,second].map(product => <td key={product.id} className="p-2">{product.stock > 0 ? "Em estoque" : "Indisponível"}</td>)}</tr>{labels.map(label => <tr key={label}><th scope="row" className="p-2">{label}</th>{[first,second].map(product => <td key={product.id} className="p-2">{product.specs.find(spec => spec.label === label)?.value || "Não informado"}</td>)}</tr>)}</tbody></table></div></details>;
}
