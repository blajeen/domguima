"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { ownerOrThrow } from "@/lib/admin/auth";
import { mutateCatalogState } from "@/lib/admin/catalog-store";
import type { ActionState } from "@/lib/admin/types";
import { readOfferSchedule, validOfferDate } from "@/lib/catalog/offer-schedule";

export async function saveOfferScheduleAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const id = String(form.get("id") ?? "");
  const starts = String(form.get("starts") ?? ""), ends = String(form.get("ends") ?? "");
  if (!id || id.length > 200 || !validOfferDate(starts) || !validOfferDate(ends) || (starts && ends && starts > ends)) return { ok: false, message: "Confira as datas: o término deve ser igual ou posterior ao início." };
  try {
    await mutateCatalogState(state => {
      if (!state.products.some(product => product.id === id && product.is_offer)) throw new Error("Oferta não encontrada.");
      const before = readOfferSchedule(state.operations.product_meta[id]);
      const meta = state.operations.product_meta[id] ?? { ncm: "", model: "", gtin: "", cost_cents: null };
      state.operations.product_meta[id] = { ...meta, offer_schedule: { starts, ends } };
      state.auditLogs.unshift({ id: randomUUID(), actor_id: owner.id, action: "product.offer_schedule_updated", entity_type: "product", entity_id: id, before_data: before, after_data: { starts, ends }, created_at: new Date().toISOString() });
      state.auditLogs = state.auditLogs.slice(0, 1000);
    }, { privateOnly: true });
    updateTag("catalog"); revalidatePath("/", "layout"); revalidatePath("/sitemap.xml");
    return { ok: true, message: "Período da oferta salvo. O preço cadastrado não foi alterado." };
  } catch { return { ok: false, message: "Não foi possível salvar o período. Atualize e tente novamente." }; }
}
