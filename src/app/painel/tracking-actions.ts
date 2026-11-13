"use server";
import { ownerOrThrow } from "@/lib/admin/auth";
import { readCatalogState } from "@/lib/admin/catalog-store";
import { adminConfig } from "@/lib/admin/config";
import { signTrackingToken } from "@/lib/admin/tracking-tokens";
import { site } from "@/config/site";
import type { ActionState } from "@/lib/admin/types";

export interface TrackingActionState extends ActionState { url?: string }
export async function createTrackingLinkAction(_: TrackingActionState, formData: FormData): Promise<TrackingActionState> {
  await ownerOrThrow();
  const id = String(formData.get("orderId") ?? "");
  if (!/^[a-f0-9-]{36}$/i.test(id)) return { message: "Pedido inválido." };
  try {
    const state = await readCatalogState(true);
    if (!state.operations.orders.some(order => order.id === id)) return { message: "Pedido não encontrado." };
    const token = await signTrackingToken(id, adminConfig.sessionSecret);
    return { ok: true, url: `${site.url.replace(/\/$/, "")}/acompanhar/${token}`, message: "Link válido por 30 dias. Compartilhe apenas com o comprador." };
  } catch { return { message: "Não foi possível gerar o link agora." }; }
}
