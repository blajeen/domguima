"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useActionState } from "react";
import { removeProductImageAction, setPrimaryImageAction, uploadProductImagesAction } from "@/app/painel/actions";
import type { AdminProductImage } from "@/lib/admin/types";
import { FormMessage, SubmitButton, fieldClass, labelClass } from "./FormControls";

export function ProductImages({ productId, images }: { productId: string; images: AdminProductImage[] }) {
  const [state, action] = useActionState(uploadProductImagesAction, {});
  const [selectedCount, setSelectedCount] = useState(0);
  const ordered = [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  return <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
    <h2 className="text-base font-black">Fotos do produto</h2>
    <p className="mt-1 text-xs text-ink-500">Selecione várias fotos de uma vez. JPG, PNG ou WebP, até 4 MB por arquivo.</p>
    {ordered.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{ordered.map((image) => <article key={image.id} className={`overflow-hidden rounded-xl border ${image.is_primary ? "border-gold-400 ring-2 ring-gold-100" : "border-ink-100"}`}>
      <div className="aspect-square bg-ink-50"><img src={image.src} alt={image.alt} className="h-full w-full object-contain p-2" /></div>
      <div className="space-y-2 border-t border-ink-100 p-2">{image.is_primary ? <p className="text-[10px] font-black uppercase tracking-wide text-gold-700">Foto principal</p> : <form action={setPrimaryImageAction}><input type="hidden" name="imageId" value={image.id} /><input type="hidden" name="productId" value={productId} /><button className="text-[11px] font-bold text-ink-600 hover:text-gold-700">Tornar principal</button></form>}<form action={removeProductImageAction}><input type="hidden" name="imageId" value={image.id} /><button className="text-[11px] font-bold text-red-600 hover:underline">Remover</button></form></div>
    </article>)}</div>}
    <form action={action} className="mt-5 grid gap-3 rounded-xl bg-ink-50 p-4 sm:grid-cols-[1.2fr_1fr_auto] sm:items-end">
      <input type="hidden" name="productId" value={productId} />
      <label className={labelClass}>Arquivos
        <input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={(event) => setSelectedCount(event.target.files?.length ?? 0)} className={`${fieldClass} file:mr-3 file:rounded-md file:border-0 file:bg-gold-100 file:px-3 file:py-1 file:font-bold`} />
        <span className="mt-1 block font-normal text-ink-400">{selectedCount ? `${selectedCount} ${selectedCount === 1 ? "foto selecionada" : "fotos selecionadas"}` : "Você pode selecionar várias fotos segurando Ctrl ou Shift."}</span>
      </label>
      <label className={labelClass}>Descrição base<input name="alt" defaultValue="Foto do produto" required className={fieldClass} /><span className="mt-1 block font-normal text-ink-400">A numeração será adicionada automaticamente.</span></label>
      <SubmitButton pendingLabel="Enviando fotos...">Enviar {selectedCount > 1 ? `${selectedCount} fotos` : "foto"}</SubmitButton>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  </section>;
}
