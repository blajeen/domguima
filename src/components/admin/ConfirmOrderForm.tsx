"use client";

import { confirmOrderAction } from "@/app/painel/actions";
import type { SellerRecord } from "@/lib/admin/types";

export function ConfirmOrderForm({ orderId, orderNumber, sellers }: { orderId: string; orderNumber: string; sellers: SellerRecord[] }) {
  return (
    <form action={confirmOrderAction} onSubmit={(event) => {
      if (!window.confirm(`Confirmar o pedido ${orderNumber} e baixar os itens do estoque?`)) event.preventDefault();
    }} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="block text-xs font-bold text-ink-600">
        Vendedor responsável
        <select name="sellerId" required defaultValue="" className="mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900">
          <option value="" disabled>Selecione</option>
          {sellers.filter((seller) => seller.active).map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
        </select>
      </label>
      <button type="submit" className="w-full rounded-lg bg-green-700 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-green-600">
        Confirmar pedido e baixar estoque
      </button>
    </form>
  );
}
