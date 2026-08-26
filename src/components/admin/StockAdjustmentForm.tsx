"use client";

import { useActionState } from "react";
import { adjustInventoryAction } from "@/app/painel/actions";
import type { AdminProductRow } from "@/lib/admin/types";
import { FormMessage, SubmitButton, fieldClass, labelClass } from "./FormControls";

export function StockAdjustmentForm({ products }: { products: AdminProductRow[] }) {
  const [state, action] = useActionState(adjustInventoryAction, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_130px_180px_130px_minmax(220px,1fr)_auto] xl:items-end">
    <label className={labelClass}>Produto<select name="productId" required className={fieldClass}><option value="">Selecione</option>{products.filter((item) => item.status !== "archived").map((product) => <option key={product.id} value={product.id}>{product.name} (atual: {product.stock})</option>)}</select></label>
    <label className={labelClass}>Quantidade<input name="quantityDelta" type="number" required placeholder="+5 ou -2" className={fieldClass} /></label>
    <label className={labelClass}>Motivo<select name="reason" className={fieldClass}><option value="manual_adjustment">Ajuste manual</option><option value="sale">Venda confirmada</option><option value="cancellation">Cancelamento</option><option value="correction">Correcao</option></select></label>
    <label className={labelClass}>Comissao (%)<input name="commissionPercent" type="number" min="0" max="100" step="0.01" defaultValue="0" placeholder="Ex.: 10" className={fieldClass} /></label>
    <label className={labelClass}>Observacao<input name="note" required placeholder="Ex.: venda pelo WhatsApp" className={fieldClass} /></label>
    <SubmitButton pendingLabel="Atualizando...">Atualizar</SubmitButton>
    <div className="sm:col-span-2 xl:col-span-5"><FormMessage state={state} /></div>
  </form>;
}
