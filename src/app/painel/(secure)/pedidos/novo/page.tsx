import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { OrderComposer, type OrderComposerLead } from "@/components/admin/OrderComposer";
import { requireOwner } from "@/lib/admin/auth";
import { phoneKey } from "@/lib/admin/customers";
import { getAdminProducts, getSalesOrders, getSellers } from "@/lib/admin/data";
import { findLead } from "@/lib/admin/leads";
import { LEAD_KIND_LABELS, type LeadRecord } from "@/lib/admin/types";
import { isTrafficSource } from "@/lib/services/origem";

type Params = Record<string, string | string[] | undefined>;

/**
 * Novo pedido. Com `?atendimento=<id>` (botão "Lançar pedido" da tela de
 * Atendimento) o formulário já vem com o cliente, o atendente e a origem do
 * atendimento, e o pedido nasce vinculado a ele — o atendimento vira Ganho ao
 * finalizar. `volta` é a lista de Atendimento de onde o operador veio.
 */
export default async function NewOrderPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOwner();
  const params = await searchParams;
  const atendimentoId = typeof params.atendimento === "string" ? params.atendimento.trim() : "";
  const voltaBruta = typeof params.volta === "string" ? params.volta : "";
  const volta = voltaBruta.startsWith("/painel/atendimento") ? voltaBruta : "/painel/atendimento";

  const [products, sellers, atendimento, pedidos] = await Promise.all([
    getAdminProducts(),
    getSellers(),
    atendimentoId ? findLead(atendimentoId) : Promise.resolve(null),
    atendimentoId ? getSalesOrders() : Promise.resolve([]),
  ]);
  const options = products.filter((product) => product.status !== "archived").map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    stock: product.stock,
    price_cents: product.price_cents,
    category_name: product.categories?.name ?? product.category_id,
    variants: (product.product_variants ?? []).filter((linha) => linha.active)
      .map((linha) => ({ id: linha.id, label: linha.label, sku: linha.sku, stock: linha.stock, price_cents: linha.price_cents })),
  }));

  // Mesma regra da action: atendimento que já acompanha um pedido vivo não
  // ganha outro (um pedido cancelado libera).
  const pedidoAtual = atendimento?.order_id ? pedidos.find((pedido) => pedido.id === atendimento.order_id) : undefined;
  const lancavel = atendimento && (!atendimento.order_id || !pedidoAtual || pedidoAtual.status === "cancelled") ? atendimento : null;
  const lead = lancavel ? paraOComposer(lancavel) : null;

  return <>
    <AdminPageHeader
      eyebrow="Venda assistida"
      title="Novo pedido"
      description="Cadastre o cliente, selecione o vendedor e finalize a venda com baixa automática no estoque."
      actions={<Link href="/painel/pedidos/importar" className="rounded-lg border border-ink-300 bg-white px-4 py-2.5 text-sm font-extrabold text-ink-800">Lançar do grupo</Link>}
    />
    {atendimentoId && !lead && (
      <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {atendimento && pedidoAtual
          ? `Este atendimento já acompanha o pedido ${pedidoAtual.number}. O pedido abaixo será lançado sem vínculo com ele.`
          : "O atendimento de origem não foi encontrado. O pedido abaixo será lançado sem vínculo com ele."}
        {" "}<Link href={volta} className="font-bold underline">Voltar ao Atendimento</Link>
      </div>
    )}
    <OrderComposer products={options} sellers={sellers} lead={lead} returnTo={lead ? volta : undefined} />
  </>;
}

/** O que o formulário precisa do atendimento, já no formato dos campos. */
function paraOComposer(lead: LeadRecord): OrderComposerLead {
  // A origem do atendimento vale mesmo fora das opções do painel (Shopee,
  // Mercado Livre...): o formulário a mostra como opção extra, e a campanha
  // dele segue para o pedido na action.
  const origem = isTrafficSource(lead.source) ? lead.source : "direct";
  return {
    id: lead.id,
    kindLabel: LEAD_KIND_LABELS[lead.kind],
    customerName: lead.customer_name,
    // Sem o 55: o campo de telefone do formulário é nacional.
    customerPhone: phoneKey(lead.customer_phone),
    sellerId: lead.seller_id,
    // Atendimento de quem veio à loja física vira venda de balcão; o resto
    // continua com o padrão do formulário (fechado pelo WhatsApp).
    channel: lead.source === "store" ? "store" : "whatsapp",
    source: origem,
  };
}
