"use client";

import { cancelOrderAction } from "@/app/painel/actions";

export function CancelOrderForm({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  return <form action={cancelOrderAction} onSubmit={(event) => { if (!window.confirm(`Cancelar o pedido ${orderNumber} e devolver os itens ao estoque?`)) event.preventDefault(); }}>
    <input type="hidden" name="orderId" value={orderId} />
    <button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50">Cancelar e devolver estoque</button>
  </form>;
}
