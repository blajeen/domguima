"use client";

import { useActionState } from "react";
import { saveCategoryAction } from "@/app/painel/actions";
import type { AdminCategoryRow } from "@/lib/admin/types";
import { FormMessage, SubmitButton, fieldClass, labelClass } from "./FormControls";

export function CategoryForm({ category }: { category?: AdminCategoryRow }) {
  const [state, action] = useActionState(saveCategoryAction, {});
  return <form action={action} className="grid gap-3 rounded-xl border border-ink-100 bg-white p-4 sm:grid-cols-2 xl:grid-cols-[90px_1fr_1fr_100px_auto] xl:items-end">
    <label className={labelClass}>Icone<input name="icon" defaultValue={category?.icon ?? "📦"} required className={fieldClass} /></label>
    <label className={labelClass}>Nome<input name="name" defaultValue={category?.name} required className={fieldClass} /></label>
    <label className={labelClass}>Endereco (slug)<input name="slug" defaultValue={category?.slug} required className={fieldClass} /></label>
    <label className={labelClass}>Ordem<input name="sortOrder" type="number" min="0" defaultValue={category?.sort_order ?? 0} required className={fieldClass} /></label>
    <div className="flex gap-4 pb-2 xl:flex-col xl:gap-1">
      <label className="text-xs font-semibold"><input name="inMainMenu" type="checkbox" defaultChecked={category?.in_main_menu ?? true} className="mr-2 accent-gold-500" />No menu</label>
      <label className="text-xs font-semibold"><input name="active" type="checkbox" defaultChecked={category?.active ?? true} className="mr-2 accent-gold-500" />Ativa</label>
    </div>
    <input type="hidden" name="id" value={category?.id ?? ""} />
    <label className={`${labelClass} sm:col-span-2 xl:col-span-4`}>Descricao<input name="description" defaultValue={category?.description} required className={fieldClass} /></label>
    <SubmitButton>{category ? "Salvar" : "Criar categoria"}</SubmitButton>
    <div className="sm:col-span-2 xl:col-span-5"><FormMessage state={state} /></div>
  </form>;
}
