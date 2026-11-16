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

/** Marca em massa: `field=offer` liga is_offer; `field=flash` liga a oferta relâmpago (product_meta). Só mexe nos ids listados em `shown`. */
export async function saveOfferSelectionAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const owner = await ownerOrThrow();
  const field = form.get("field") === "flash" ? "flash" : "offer";
  const shown = new Set(form.getAll("shown").map(String));
  const checked = new Set(form.getAll("ids").map(String));
  try {
    await mutateCatalogState(state => {
      const now = new Date().toISOString();
      for (const product of state.products) {
        if (!shown.has(product.id)) continue;
        const on = checked.has(product.id);
        if (field === "offer") {
          if (product.is_offer === on) continue;
          product.is_offer = on;
          product.updated_at = now;
        } else {
          const meta = state.operations.product_meta[product.id] ?? { ncm: "", model: "", gtin: "", cost_cents: null };
          if (Boolean(meta.flash_offer) === on) continue;
          state.operations.product_meta[product.id] = { ...meta, flash_offer: on };
        }
        state.auditLogs.unshift({ id: randomUUID(), actor_id: owner.id, action: field === "offer" ? "product.offer_toggled" : "product.flash_offer_toggled", entity_type: "product", entity_id: product.id, before_data: { on: !on }, after_data: { on }, created_at: now });
      }
      state.auditLogs = state.auditLogs.slice(0, 1000);
    });
    updateTag("catalog"); revalidatePath("/", "layout"); revalidatePath("/sitemap.xml");
    return { ok: true, message: field === "offer" ? "Seleção de ofertas salva." : "Oferta relâmpago salva." };
  } catch { return { ok: false, message: "Não foi possível salvar. Atualize e tente novamente." }; }
}
