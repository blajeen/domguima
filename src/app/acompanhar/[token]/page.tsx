import type { Metadata } from "next";
import Link from "next/link";
import { getTrackedOrder } from "@/lib/admin/order-tracking";
import { DELIVERY_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/admin/crm-workflow-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Acompanhar pedido", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function TrackOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let order: Awaited<ReturnType<typeof getTrackedOrder>> = null;
  try { order = await getTrackedOrder(token); } catch { /* Generic status, never database details. */ }
  return <div className="mx-auto max-w-xl px-4 py-12"><h1 className="text-3xl font-black text-ink-900">Acompanhar pedido</h1>{order ? <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-card"><h2 className="text-lg font-bold">{order.number}</h2><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-ink-500">Pedido</dt><dd className="font-bold">{order.status === "completed" ? "Confirmado" : order.status === "cancelled" ? "Cancelado" : "Aguardando confirmação"}</dd></div><div><dt className="text-ink-500">Pagamento</dt><dd className="font-bold">{PAYMENT_STATUS_LABELS[order.payment ?? "unconfirmed"] ?? "A confirmar com a loja"}</dd></div><div><dt className="text-ink-500">Entrega / retirada</dt><dd className="font-bold">{DELIVERY_STATUS_LABELS[order.delivery ?? "unconfirmed"] ?? "A confirmar com a loja"}</dd></div></dl><p className="mt-5 text-xs leading-relaxed text-ink-500">Situações atualizadas pela equipe da Dom Guima. Confirmação do pedido não significa pagamento recebido ou entrega concluída.</p></section> : <p role="status" className="mt-6 rounded-xl bg-ink-50 p-5 text-sm text-ink-600">Este link expirou, está indisponível ou o pedido não foi encontrado. Peça um novo link à equipe da loja.</p>}<Link href="/conta" className="mt-6 inline-block font-bold text-blue-700 underline">Falar com a equipe e ver opções de suporte</Link></div>;
}
