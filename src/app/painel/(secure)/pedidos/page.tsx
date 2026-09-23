import Link from "next/link";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { AssignOrderForm } from "@/components/admin/AssignOrderForm";
import { CancelOrderForm } from "@/components/admin/CancelOrderForm";
import { ConfirmOrderForm } from "@/components/admin/ConfirmOrderForm";
import { bulkOrdersAction } from "@/app/painel/actions";
import { InstallmentSimulator } from "@/components/admin/InstallmentSimulator";
import { OrderBulkActions } from "@/components/admin/OrderBulkActions";
import { requireOwner } from "@/lib/admin/auth";
import { buildCustomerIndex, phoneKey, recurrenceBadge } from "@/lib/admin/customers";
import { getSalesOrders, getSellers } from "@/lib/admin/data";
import { channelFilterParam, matchesOriginFilters, ORIGIN_FILTER_NOT_INFORMED, sourceFilterParam } from "@/lib/admin/reports";
import {
  ORDER_CHANNEL_LABELS,
  ORDER_PAYMENT_METHOD_LABELS,
  ORIGIN_NOT_INFORMED_LABEL,
  TRAFFIC_SOURCE_LABELS,
  UNASSIGNED_ORDER_SELLER_ID,
  type SalesOrderRecord,
} from "@/lib/admin/types";
import { attributionCampaign, latestCampaign, orderChannelLabel, trafficSourceLabel } from "@/lib/services/origem";
import { customerWhatsappLink } from "@/lib/services/whatsapp";
import { formatPrice, normalize } from "@/lib/utils/format";
import { onlyDigits } from "@/lib/utils/validators";

type Params = Record<string, string | string[] | undefined>;

/** `id` do formulário de ações em massa; os checkboxes dos cards se ligam a ele por `form=`. */
const BULK_FORM_ID = "pedidos-em-massa";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOwner();
  const params = await searchParams;
  const [allOrders, sellers] = await Promise.all([getSalesOrders(), getSellers()]);
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const seller = typeof params.vendedor === "string" ? params.vendedor : "";
  const status = params.status === "cancelled" ? "cancelled" : params.status === "completed" ? "completed" : params.status === "pending" ? "pending" : "";
  const canal = channelFilterParam(params.canal);
  const origem = sourceFilterParam(params.origem);
  // Quem é quem: telefone e CPF que aparecem juntos em algum pedido são o mesmo
  // cliente. Serve à busca abaixo e à etiqueta de recorrência de cada card.
  const clientes = buildCustomerIndex(allOrders);
  // Busca digitada só com número (telefone ou CPF, com ou sem pontuação e o
  // 55): traz TODOS os pedidos do cliente, inclusive os que têm só o outro
  // documento.
  const digitosDaBusca = /^[\d\s().+/-]+$/.test(query) ? onlyDigits(query) : "";
  const clienteDaBusca = digitosDaBusca.length >= 10 ? clientes.keyOf(phoneKey(digitosDaBusca)) ?? clientes.keyOf(digitosDaBusca) : null;
  // "Ver pedidos" da tela de Clientes: o cliente vem pelo número de um pedido
  // dele (nunca o telefone ou o CPF na URL) e a lista traz todos os pedidos
  // dele, inclusive os feitos com outro telefone ou só com o CPF.
  const clienteRef = typeof params.cliente === "string" ? params.cliente.trim() : "";
  const clienteDoLink = clienteRef ? clientes.keyOfOrderNumber(clienteRef) : null;
  const orders = allOrders.filter((order) => {
    // A campanha entra na busca: "natal" acha os pedidos que vieram do link da campanha de Natal.
    // O telefone entra como foi digitado e só em dígitos: "(34) 99999" e "3499999" acham o mesmo pedido.
    const searchable = normalize(`${order.number} ${order.customer.name} ${order.customer.cpf} ${order.customer.phone} ${onlyDigits(order.customer.phone ?? "")} ${order.seller_name} ${attributionCampaign(order.attribution)} ${order.items.map((item) => `${item.product_name} ${item.sku}`).join(" ")}`);
    const achouPelaBusca = !query
      || searchable.includes(normalize(query))
      || (digitosDaBusca.length >= 4 && searchable.includes(digitosDaBusca))
      || (clienteDaBusca !== null && clientes.keyOfOrder(order) === clienteDaBusca);
    return achouPelaBusca
      && (!clienteRef || (clienteDoLink !== null && clientes.keyOfOrder(order) === clienteDoLink))
      && (!seller || order.seller_id === seller)
      && (!status || order.status === status)
      && matchesOriginFilters(order, { channel: canal, source: origem });
  });
  // Filtros atuais, para a atribuição voltar à mesma lista.
  const filtros = new URLSearchParams();
  for (const [chave, valor] of [["q", query], ["vendedor", seller], ["status", status], ["canal", canal], ["origem", origem], ["cliente", clienteRef]] as const) {
    if (valor) filtros.set(chave, valor);
  }
  const volta = filtros.toString() ? `/painel/pedidos?${filtros.toString()}` : "/painel/pedidos";
  const semCliente = new URLSearchParams(filtros);
  semCliente.delete("cliente");
  const created = typeof params.criado === "string" ? allOrders.find((order) => order.id === params.criado) : null;
  const confirmed = typeof params.confirmado === "string" ? allOrders.find((order) => order.id === params.confirmado) : null;
  const cancelled = typeof params.cancelado === "string";
  const errorMessage = typeof params.erro === "string" ? params.erro : "";
  const feito = typeof params.feito === "string" ? params.feito : "";

  return (
    <>
      <AdminPageHeader
        eyebrow="Operação comercial"
        title="Pedidos"
        description={`${orders.length} de ${allOrders.length} pedidos`}
        actions={<div className="flex flex-wrap gap-2">
          <Link href="/painel/pedidos/importar" className="rounded-lg border border-ink-300 bg-white px-4 py-2.5 text-sm font-extrabold text-ink-800">Lançar do grupo</Link>
          <Link href="/painel/pedidos/novo" className="rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-extrabold text-ink-950">+ Novo pedido</Link>
        </div>}
      />
      {created && <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><strong>Pedido {created.number} finalizado.</strong> O estoque e a comissão foram atualizados.</div>}
      {confirmed && <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><strong>Pedido {confirmed.number} confirmado.</strong> O estoque e a comissão foram atualizados.</div>}
      {cancelled && <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Pedido cancelado.</div>}
      {feito && <div role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{feito}</div>}
      {errorMessage && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>}
      {clienteRef && (
        <div role="status" className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {clienteDoLink
            ? `Mostrando só os pedidos do cliente do pedido ${clienteRef}, com qualquer telefone ou CPF dele.`
            : `Nenhum cliente encontrado para o pedido ${clienteRef}.`}
          {" "}<Link href={semCliente.toString() ? `/painel/pedidos?${semCliente.toString()}` : "/painel/pedidos"} className="font-bold underline">Ver todos os pedidos</Link>
        </div>
      )}

      <PanelCard>
        {/* flex-wrap: com canal e origem são seis campos, e uma grade fixa
            quebraria a linha em telas médias. */}
        <form className="flex flex-wrap items-end gap-3">
          {clienteRef && <input type="hidden" name="cliente" value={clienteRef} />}
          <label className="min-w-[220px] flex-1 text-xs font-bold text-ink-600">Buscar<input name="q" defaultValue={query} placeholder="Pedido, cliente, CPF, telefone, produto, SKU ou campanha" className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm" /></label>
          <label className="w-44 text-xs font-bold text-ink-600">Vendedor<select name="vendedor" defaultValue={seller} className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"><option value="">Todos</option><option value={UNASSIGNED_ORDER_SELLER_ID}>Fila livre (sem atendente)</option>{sellers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="w-44 text-xs font-bold text-ink-600">Status<select name="status" defaultValue={status} className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"><option value="">Todos</option><option value="pending">Aguardando confirmação</option><option value="completed">Finalizados</option><option value="cancelled">Cancelados</option></select></label>
          <label className="w-40 text-xs font-bold text-ink-600">Canal<select name="canal" defaultValue={canal} className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"><option value="">Todos</option>{Object.entries(ORDER_CHANNEL_LABELS).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}<option value={ORIGIN_FILTER_NOT_INFORMED}>{ORIGIN_NOT_INFORMED_LABEL}</option></select></label>
          <label className="w-40 text-xs font-bold text-ink-600">Origem<select name="origem" defaultValue={origem} className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"><option value="">Todas</option>{Object.entries(TRAFFIC_SOURCE_LABELS).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}<option value={ORIGIN_FILTER_NOT_INFORMED}>{ORIGIN_NOT_INFORMED_LABEL}</option></select></label>
          <button className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-bold text-white">Filtrar</button>
        </form>
      </PanelCard>

      {/* O formulário de massa NÃO envolve a lista: cada card tem os próprios
          formulários (atribuir, confirmar, cancelar) e form dentro de form é
          HTML inválido. Os checkboxes se ligam a ele pelo atributo `form=`. */}
      {orders.length > 0 && (
        <form id={BULK_FORM_ID} action={bulkOrdersAction} className="mt-5">
          <OrderBulkActions total={orders.length} formId={BULK_FORM_ID} />
        </form>
      )}
      <div className={`space-y-3 ${orders.length ? "" : "mt-5"}`}>
        {orders.map((order) => {
          // Cancelado não ganha etiqueta: a venda não aconteceu, e "Cliente
          // novo" num pedido que não existiu só confunde. "Recorrente" = o
          // cliente já tinha compra finalizada ANTES deste pedido.
          const chave = order.status === "cancelled" ? null : clientes.keyOfOrder(order);
          return (
            <OrderRow
              key={order.id}
              order={order}
              sellers={sellers}
              volta={volta}
              customer={chave ? recurrenceBadge(clientes.completedBefore(chave, order.created_at), clientes.completedOrders(chave)) : null}
            />
          );
        })}
        {!orders.length && <PanelCard><p className="py-10 text-center text-sm text-ink-500">Nenhum pedido corresponde aos filtros.</p></PanelCard>}
      </div>
    </>
  );
}

function OrderRow({ order, sellers, volta, customer }: {
  order: SalesOrderRecord;
  sellers: Awaited<ReturnType<typeof getSellers>>;
  volta: string;
  /** Etiqueta de recorrência; `null` quando o pedido não tem telefone nem CPF (ou foi cancelado). */
  customer: { returning: boolean; label: string } | null;
}) {
  const payment = order.payment_method ? ORDER_PAYMENT_METHOD_LABELS[order.payment_method] : "Pagamento a combinar";
  const delivery = order.delivery_method === "uberlandia_delivery" ? "Entrega em Uberlândia" : "Frete a combinar";
  // Pedido do site que ninguém assumiu ainda: "Fila livre", no mesmo tom da
  // tela de Atendimento, em vez do rótulo técnico gravado no banco.
  const semAtendente = order.seller_id === UNASSIGNED_ORDER_SELLER_ID;
  const campanha = attributionCampaign(order.attribution);
  const ultimaCampanha = latestCampaign(order.attribution);

  return (
    <article className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
      <div className="grid gap-4 p-5 sm:grid-cols-[auto_1.2fr_1fr_auto] sm:items-center">
        <label className="flex items-center gap-2 self-start sm:self-center">
          <input type="checkbox" name="orderIds" value={order.id} form={BULK_FORM_ID} className="h-4 w-4" aria-label={`Selecionar pedido ${order.number}`} />
          <span className="text-xs font-bold text-ink-400 sm:hidden">Selecionar</span>
        </label>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-black text-ink-900">{order.number}</h2>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${order.status === "completed" ? "bg-green-50 text-green-700" : order.status === "pending" ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>
              {order.status === "completed" ? "Finalizado" : order.status === "pending" ? "Aguardando confirmação" : "Cancelado"}
            </span>
            {customer && (customer.returning
              ? <Link href={`/painel/clientes?cliente=${encodeURIComponent(order.number)}`} title="Ver o histórico deste cliente" className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700 hover:underline">{customer.label}</Link>
              : <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase text-sky-700">{customer.label}</span>)}
            {/* Canal e origem só aparecem quando conhecidos: pedido antigo não
                ganha uma etiqueta "Não informado" em cada card. */}
            {order.channel && <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[10px] font-black uppercase text-ink-600">{orderChannelLabel(order.channel)}</span>}
            {order.source && <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-black uppercase text-purple-700">{trafficSourceLabel(order.source)}</span>}
            {campanha && <span className="rounded-full bg-gold-50 px-2.5 py-1 text-[10px] font-black text-gold-800" title="Campanha (utm_campaign) do link por onde o cliente chegou">Campanha: {campanha}</span>}
          </div>
          <p className="mt-1 text-sm font-semibold">{order.customer.name}</p>
          <p className="text-xs text-ink-500">{order.customer.cpf} · {order.customer.city}/{order.customer.state}</p>
        </div>
        <div>
          <p className="text-xs text-ink-400">{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(order.created_at))}</p>
          <p className="mt-1 text-sm">
            {semAtendente ? <strong className="text-orange-700">Fila livre</strong> : <strong>{order.seller_name}</strong>} · {order.total_units} unidade(s)
          </p>
          <p className="text-xs text-ink-500">Comissão {formatPrice(order.commission_total_cents)}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-2xl font-black">{formatPrice(order.total_cents)}</p>
          {order.discount_total_cents > 0 && <p className="text-xs text-green-700">Desconto {formatPrice(order.discount_total_cents)}</p>}
        </div>
      </div>

      <details className="border-t border-ink-100">
        <summary className="cursor-pointer px-5 py-3 text-xs font-bold text-blue-700 hover:bg-blue-50">Ver itens e dados do pedido</summary>
        <div className="border-t border-ink-100 bg-ink-50/50 p-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-xs">
                <thead className="uppercase text-ink-400"><tr><th className="py-2">Produto</th><th>Qtd.</th><th>Preço</th><th>Desconto</th><th>Comissão</th><th>Total</th></tr></thead>
                <tbody className="divide-y divide-ink-200">
                  {order.items.map((item) => <tr key={`${item.product_id}-${item.variant ?? ""}`}><td className="py-3"><strong>{item.product_name}</strong>{item.variant && <span className="block text-ink-500">{item.variant}</span>}<span className="block text-ink-400">SKU {item.sku}</span></td><td>{item.quantity}</td><td>{formatPrice(item.unit_price_cents)}</td><td>{formatPrice(item.discount_cents)}</td><td>{formatPrice(item.commission_total_cents)}</td><td className="font-black">{formatPrice(item.line_total_cents)}</td></tr>)}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-ink-200 bg-white p-4 text-xs leading-relaxed text-ink-600">
              <p className="font-black text-ink-900">Entrega e pagamento</p>
              <p className="mt-2"><strong>Entrega:</strong> {delivery}</p>
              <p><strong>Pagamento:</strong> {payment}</p>
              <p className="mt-2">{order.customer.street}, {order.customer.number}{order.customer.complement ? ` · ${order.customer.complement}` : ""}</p>
              <p>{order.customer.neighborhood} · {order.customer.city}/{order.customer.state}</p>
              <p>CEP {order.customer.cep}</p>
              {order.customer.phone && <p className="mt-2">Telefone {order.customer.phone}</p>}
              {order.customer.email && <p>E-mail {order.customer.email}</p>}
              {order.notes && <p className="mt-3 border-t border-ink-100 pt-3"><strong>Observações:</strong> {order.notes}</p>}

              <div className="mt-3 border-t border-ink-100 pt-3">
                <p className="font-black text-ink-900">Origem do cliente</p>
                <p className="mt-1"><strong>Canal:</strong> {orderChannelLabel(order.channel)} · <strong>Origem:</strong> {trafficSourceLabel(order.source)}</p>
                {campanha && <p><strong>Campanha:</strong> {campanha}{order.attribution.utm_medium ? ` (${order.attribution.utm_medium})` : ""}</p>}
                {ultimaCampanha && ultimaCampanha !== campanha && <p><strong>Voltou pela campanha:</strong> {ultimaCampanha}</p>}
                {order.attribution.referrer && <p><strong>Veio de:</strong> {order.attribution.referrer}</p>}
                {order.attribution.landing_path && <p><strong>Primeira página:</strong> {order.attribution.landing_path}</p>}
                {(order.attribution.fbclid || order.attribution.gclid) && <p>Chegou por anúncio {order.attribution.gclid ? "do Google" : "do Facebook/Instagram"}.</p>}
              </div>

              {order.status === "pending" && <div className="mt-4 space-y-4 border-t border-blue-100 pt-4">
                <div><p className="font-black text-blue-950">Próximo passo</p><p className="mt-1 text-xs leading-relaxed text-blue-800">Defina quem cuida do pedido, fale com o cliente e confirme disponibilidade, frete e pagamento. Depois confirme para baixar o estoque. Quando enviar, avise o cliente pelo WhatsApp.</p></div>
                {order.customer.phone && <a href={customerWhatsappLink(order.customer.phone, customerOrderMessage(order))} target="_blank" rel="noopener noreferrer" className="block w-full rounded-lg bg-[#25D366] px-3 py-2.5 text-center text-xs font-extrabold text-white hover:bg-[#20bd5a]">Abrir WhatsApp do cliente</a>}
                {/* `key` pelo atendente: depois de "Atribuir" a página volta só com a
                    query nova, e o Next não remonta a árvore por mudança de query. Sem
                    remontar, os <select defaultValue> continuariam no atendente antigo
                    (o React não reaplica defaultValue) e o Confirmar não viria com
                    quem acabou de assumir o pedido. */}
                <AssignOrderForm key={`atribuir-${order.seller_id}`} orderId={order.id} currentSellerId={order.seller_id} sellers={sellers} volta={volta} />
                <div key={`confirmar-${order.seller_id}`} className="border-t border-blue-100 pt-4">
                  <ConfirmOrderForm orderId={order.id} orderNumber={order.number} sellers={sellers} defaultSellerId={semAtendente ? "" : order.seller_id} />
                </div>
              </div>}
              {order.status === "completed" && <div className="mt-4"><CancelOrderForm orderId={order.id} orderNumber={order.number} /></div>}
              {order.status === "cancelled" && <p className="mt-4 border-t border-ink-100 pt-4 text-xs text-ink-400">Pedido cancelado. Confira o histórico se precisar auditar a operação.</p>}
              {order.status !== "cancelled" && <div className="mt-4 border-t border-ink-100 pt-4"><InstallmentSimulator cents={order.total_cents} titulo={`Parcelamento de ${order.number}`} /></div>}
            </div>
          </div>
        </div>
      </details>
    </article>
  );
}

function customerOrderMessage(order: SalesOrderRecord): string {
  const items = order.items.map((item) => `• ${item.quantity}x ${item.product_name}${item.variant ? ` (${item.variant})` : ""}`).join("\n");
  const payment = order.payment_method ? ORDER_PAYMENT_METHOD_LABELS[order.payment_method] : "Pagamento a combinar";
  return [
    `Olá, ${order.customer.name}! Aqui é da Dom Guima.`,
    `Recebemos sua solicitação ${order.number} pelo site e estamos conferindo a disponibilidade.`,
    "",
    items,
    "",
    `Total dos produtos: ${formatPrice(order.total_cents)}`,
    `Preferência de pagamento: ${payment}`,
    "Podemos confirmar o pedido, o frete e a forma de pagamento com você?",
  ].join("\n");
}
