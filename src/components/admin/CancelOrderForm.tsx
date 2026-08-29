"use client";

import { cancelOrderAction } from "@/app/painel/actions";

export function CancelOrderForm({ orderId, orderNumber, restoreStock = true }: { orderId: string; orderNumber: string; restoreStock?: boolean }) {
  const action = restoreStock ? `Cancelar o pedido ${orderNumber} e devolver os itens ao estoque?` : `Cancelar a solicitação ${orderNumber}?`;
  return <form action={cancelOrderAction} onSubmit={(event) => { if (!window.confirm(action)) event.preventDefault(); }}>
    <input type="hidden" name="orderId" value={orderId} />
    <button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50">{restoreStock ? "Cancelar e devolver estoque" : "Cancelar solicitação"}</button>
  </form>;
}
