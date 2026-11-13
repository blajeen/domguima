import "server-only";
import { adminConfig, hasSupabaseConfig } from "./config";
import { readCatalogState } from "./catalog-store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyTrackingToken } from "./tracking-tokens";
import type { CrmWorkflowEntry } from "./crm-workflow-types";

/** Public result deliberately contains no customer identity, address, items or price. */
export async function getTrackedOrder(token: string) {
  const id = await verifyTrackingToken(token, adminConfig.sessionSecret);
  if (!id) return null;
  if (hasSupabaseConfig()) {
    const client = createSupabaseAdminClient();
    const [{ data: order, error }, { data: settings }] = await Promise.all([
      client.from("sales_orders").select("number,status").eq("id", id).maybeSingle(),
      client.from("store_settings").select("settings").eq("id", "store").maybeSingle(),
    ]);
    if (error || !order) return null;
    const notes = (settings?.settings as { __operations?: { crm_workflow?: Record<string, CrmWorkflowEntry> } } | undefined)?.__operations?.crm_workflow?.[`order:${id}`];
    return { number: String(order.number), status: String(order.status), payment: notes?.payment_status, delivery: notes?.delivery_status };
  }
  const state = await readCatalogState(true), order = state.operations.orders.find(item => item.id === id);
  if (!order) return null;
  const notes = state.operations.crm_workflow?.[`order:${id}`];
  return { number: order.number, status: order.status, payment: notes?.payment_status, delivery: notes?.delivery_status };
}
