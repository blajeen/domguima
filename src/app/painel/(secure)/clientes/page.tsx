import Link from "next/link";
import { customerContactAction } from "@/app/painel/actions";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { CrmMigrationNotice } from "@/components/admin/CrmMigrationNotice";
import { requireOwner } from "@/lib/admin/auth";
import {
  customerMatches,
  INACTIVE_AFTER_DAYS,
  repurchaseSuggestions,
  REPURCHASE_MAX_DAYS,
  REPURCHASE_MIN_DAYS,
  RETURNING_MIN_ORDERS,
  VIP_MIN_ORDERS,
  VIP_MIN_TOTAL_CENTS,
} from "@/lib/admin/customers";
import { getCustomers } from "@/lib/admin/data";
import { CUSTOMER_SEGMENT_LABELS, CUSTOMER_SEGMENTS, type CustomerSegment, type CustomerSummary } from "@/lib/admin/types";
import { customerWhatsappLink, recompraMessage } from "@/lib/services/whatsapp";
import { formatPrice } from "@/lib/utils/format";
import { formatDocument, formatPhone } from "@/lib/utils/validators";

type Params = Record<string, string | string[] | undefined>;
/** Segmento, ou "recorrentes" = 2 compras ou mais em qualquer segmento (o card do painel). */
type FiltroSegmento = CustomerSegment | "recorrentes" | "";
/** Janela da última compra: últimos N dias, ou a faixa das sugestões de recontato. */
type FiltroDias = "30" | "90" | "recontato" | "";
type Ordem = "recente" | "total" | "compras";

const CAMPO = "mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm";
/** A tabela para aqui: além disso, a busca e os filtros acham o cliente mais rápido que a rolagem. */
const LIMITE_DA_TABELA = 300;
const LIMITE_DE_SUGESTOES = 12;
const DATA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" });

const COR_DO_SEGMENTO: Record<CustomerSegment, string> = {
  new: "bg-sky-50 text-sky-700",
  returning: "bg-emerald-50 text-emerald-700",
  vip: "bg-gold-50 text-gold-800",
  inactive: "bg-ink-100 text-ink-600",
};

const ROTULO_DOS_DIAS: Record<Exclude<FiltroDias, "">, string> = {
  "30": "Nos últimos 30 dias",
  "90": "Nos últimos 90 dias",
  recontato: `Entre ${REPURCHASE_MIN_DAYS} e ${REPURCHASE_MAX_DAYS} dias (recontato)`,
};

/**
 * CLIENTES — quem já comprou, quem voltou e quem vale a pena chamar de novo.
 *
 * A loja não tem cadastro de cliente: tudo aqui é calculado dos pedidos
 * FINALIZADOS, reconhecendo o cliente pelo telefone ou CPF (customers.ts).
 * Recontato é sempre manual: o botão abre o WhatsApp com a mensagem pronta,
 * nada é enviado sozinho e não há cobrança recorrente — decisão do dono.
 */
export default async function ClientesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOwner();
  const params = await searchParams;
  const query = texto(params.q).trim();
  const segmentoBruto = texto(params.segmento);
  const segmento: FiltroSegmento = segmentoBruto === "recorrentes" || CUSTOMER_SEGMENTS.some((valor) => valor === segmentoBruto) ? (segmentoBruto as FiltroSegmento) : "";
  const diasBruto = texto(params.dias);
  const dias: FiltroDias = diasBruto === "30" || diasBruto === "90" || diasBruto === "recontato" ? diasBruto : "";
  const ordem: Ordem = params.ordem === "total" ? "total" : params.ordem === "compras" ? "compras" : "recente";
  // Etiqueta "Recorrente" de Pedidos e Atendimento e "Ver histórico" do Novo
  // pedido: o cliente vem pelo número de um pedido dele, nunca pelo telefone
  // ou CPF, que ficariam no histórico do navegador e nos registros de acesso.
  const clienteRef = texto(params.cliente).trim();
  const feito = texto(params.feito);
  const erro = texto(params.erro);

  // Os filtros viajam na volta das ações (recontato recusado/permitido), senão
  // cada clique jogaria o operador de volta para a lista cheia.
  const filtros = new URLSearchParams();
  for (const [chave, valor] of [["q", query], ["segmento", segmento], ["dias", dias], ["ordem", ordem === "recente" ? "" : ordem], ["cliente", clienteRef]] as const) {
    if (valor) filtros.set(chave, valor);
  }
  const volta = filtros.toString() ? `/painel/clientes?${filtros.toString()}` : "/painel/clientes";

  const { book: livro, index: indice } = await getCustomers();
  const chaveDoLink = clienteRef ? indice.keyOfOrderNumber(clienteRef) : null;
  const todos = livro.customers;
  const porSegmento = new Map<CustomerSegment, number>(CUSTOMER_SEGMENTS.map((valor) => [valor, 0]));
  for (const cliente of todos) porSegmento.set(cliente.segment, (porSegmento.get(cliente.segment) ?? 0) + 1);

  const filtrados = todos
    .filter((cliente) => customerMatches(cliente, query)
      && (!clienteRef || cliente.key === chaveDoLink)
      && (!segmento || (segmento === "recorrentes" ? cliente.ordersCount >= RETURNING_MIN_ORDERS : cliente.segment === segmento))
      && dentroDaJanela(cliente, dias))
    .sort((a, b) => (ordem === "total"
      ? b.totalCents - a.totalCents
      : ordem === "compras"
        ? b.ordersCount - a.ordersCount || b.totalCents - a.totalCents
        : b.lastOrderAt.localeCompare(a.lastOrderAt)));
  const visiveis = filtrados.slice(0, LIMITE_DA_TABELA);
  const sugestoes = repurchaseSuggestions(todos);
  // Quem pediu para não ser chamado sai das sugestões; a conta aparece no card
  // para a lista mais curta não parecer erro.
  const recusaramNaFaixa = todos.filter((cliente) => cliente.contactOptOut && dentroDaJanela(cliente, "recontato")).length;
  const filtrando = Boolean(query || segmento || dias || clienteRef);

  return (
    <>
      <AdminPageHeader
        eyebrow="Operação comercial"
        title="Clientes"
        description={`${todos.length} cliente(s) reconhecido(s) pelo telefone ou CPF nas compras finalizadas.`}
        actions={<>
          <Link href="/painel/atendimento" className="rounded-lg border border-ink-300 bg-white px-4 py-2.5 text-sm font-extrabold text-ink-800">Atendimento</Link>
          <Link href="/painel/pedidos" className="rounded-lg border border-ink-300 bg-white px-4 py-2.5 text-sm font-extrabold text-ink-800">Ver pedidos</Link>
        </>}
      />
      {/* Sem a tabela de atendimentos o aviso de "atendimento em aberto" some
          da lista sem explicação. */}
      <CrmMigrationNotice />
      {feito && <div role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{feito}</div>}
      {erro && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {CUSTOMER_SEGMENTS.map((valor) => (
          <PanelCard key={valor} className="p-4">
            <Link href={`/painel/clientes?segmento=${valor}`} aria-current={segmento === valor ? "true" : undefined} className="block rounded-lg hover:opacity-80">
              <p className="text-xs font-semibold text-ink-500">{CUSTOMER_SEGMENT_LABELS[valor]}</p>
              <p className="mt-2 text-3xl font-black text-ink-900">{porSegmento.get(valor) ?? 0}</p>
              <p className="mt-1 text-xs text-ink-500">{regraDoSegmento(valor)}</p>
            </Link>
          </PanelCard>
        ))}
        <PanelCard className="p-4">
          <p className="text-xs font-semibold text-ink-500">Sem identificação</p>
          <p className="mt-2 text-3xl font-black text-ink-400">{livro.unidentifiedOrders}</p>
          <p className="mt-1 text-xs text-ink-500">
            Compra(s) finalizada(s) sem telefone nem CPF — em geral lançamentos do grupo{livro.unidentifiedTotalCents > 0 ? ` (${formatPrice(livro.unidentifiedTotalCents)})` : ""}. Ficam fora dos clientes porque não há como saber de quem são.
          </p>
        </PanelCard>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-500">
        Só contam pedidos finalizados. “Inativo” vale sobre os outros: quem não compra há mais de {INACTIVE_AFTER_DAYS} dias aparece como inativo mesmo que já tenha sido VIP — compras e total continuam na tabela.
      </p>

      <PanelCard className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-black">Sugestões de recontato</h2>
          {sugestoes.length > LIMITE_DE_SUGESTOES && (
            <Link href="/painel/clientes?dias=recontato&ordem=total" className="text-xs font-bold text-blue-700 hover:underline">Ver as {sugestoes.length} sugestões</Link>
          )}
        </div>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-500">
          Última compra entre {REPURCHASE_MIN_DAYS} e {REPURCHASE_MAX_DAYS} dias atrás, quem mais comprou primeiro. O botão abre o WhatsApp com uma mensagem pronta sobre a última compra, para você revisar antes de enviar — nada sai sozinho e a mensagem não oferece desconto nenhum.
          {" "}Se o cliente disser que não quer esse contato, clique em “Não quer recontato”: ele sai desta lista, como a política de privacidade promete.
          {recusaramNaFaixa > 0 && ` ${recusaramNaFaixa} cliente(s) desta faixa pediram para não ser chamados e ficam de fora.`}
        </p>
        {sugestoes.length ? (
          <ul className="mt-4 divide-y divide-ink-100">
            {sugestoes.slice(0, LIMITE_DE_SUGESTOES).map((cliente) => (
              <li key={cliente.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-bold text-ink-900">
                    {cliente.name || "Cliente sem nome"}
                    <span className={`ml-2 rounded-full px-2 py-0.5 align-middle text-[10px] font-black uppercase ${COR_DO_SEGMENTO[cliente.segment]}`}>{CUSTOMER_SEGMENT_LABELS[cliente.segment]}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    Última compra {haDias(cliente.daysSinceLastOrder)} ({DATA.format(new Date(cliente.lastOrderAt))}) · {cliente.ordersCount} compra(s) · {formatPrice(cliente.totalCents)}
                  </p>
                  {cliente.openLeads > 0 && <p className="mt-0.5 text-xs font-bold text-orange-700">Já tem {cliente.openLeads} atendimento(s) em aberto: combine com quem está atendendo antes de chamar.</p>}
                </div>
                <AcoesDoCliente cliente={cliente} volta={volta} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-ink-500">Nenhum cliente com a última compra nessa faixa agora.</p>
        )}
      </PanelCard>

      <PanelCard className="mt-5">
        <form className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-xs font-bold text-ink-600">Buscar<input name="q" defaultValue={query} placeholder="Nome, telefone ou CPF" className={CAMPO} /></label>
          <label className="w-48 text-xs font-bold text-ink-600">Segmento
            <select name="segmento" defaultValue={segmento} className={CAMPO}>
              <option value="">Todos</option>
              {CUSTOMER_SEGMENTS.map((valor) => <option key={valor} value={valor}>{CUSTOMER_SEGMENT_LABELS[valor]}</option>)}
              <option value="recorrentes">Comprou {RETURNING_MIN_ORDERS} vezes ou mais</option>
            </select>
          </label>
          <label className="w-56 text-xs font-bold text-ink-600">Última compra
            <select name="dias" defaultValue={dias} className={CAMPO}>
              <option value="">Qualquer data</option>
              {(Object.keys(ROTULO_DOS_DIAS) as Array<keyof typeof ROTULO_DOS_DIAS>).map((valor) => <option key={valor} value={valor}>{ROTULO_DOS_DIAS[valor]}</option>)}
            </select>
          </label>
          <label className="w-44 text-xs font-bold text-ink-600">Ordenar por
            <select name="ordem" defaultValue={ordem} className={CAMPO}>
              <option value="recente">Compra mais recente</option>
              <option value="total">Maior total</option>
              <option value="compras">Mais compras</option>
            </select>
          </label>
          <button className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-bold text-white">Filtrar</button>
          {filtrando && <Link href="/painel/clientes" className="py-2.5 text-sm font-bold text-blue-700 hover:underline">Limpar</Link>}
        </form>
      </PanelCard>

      <PanelCard className="mt-5">
        {clienteRef && (
          <p role="status" className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            {chaveDoLink
              ? `Mostrando o cliente do pedido ${clienteRef}.`
              : `Nenhum cliente com compra finalizada encontrado para o pedido ${clienteRef}.`}
            {" "}<Link href="/painel/clientes" className="font-bold underline">Ver todos os clientes</Link>
          </p>
        )}
        <p className="text-xs text-ink-500">
          {filtrados.length} cliente(s){filtrados.length > LIMITE_DA_TABELA ? ` · mostrando os ${LIMITE_DA_TABELA} primeiros — use a busca ou os filtros para achar os demais` : ""}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="text-xs uppercase text-ink-400">
              <tr><th className="py-2">Cliente</th><th>Telefone</th><th>Compras</th><th>Total</th><th>Última compra</th><th>Segmento</th><th className="text-right">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visiveis.map((cliente) => (
                <tr key={cliente.key} className="align-top">
                  <td className="py-3 pr-3">
                    <p className="font-bold text-ink-900">{cliente.name || "Cliente sem nome"}</p>
                    {cliente.contactOptOut && <p className="text-xs font-bold text-red-700">Não quer recontato</p>}
                    {cliente.cpf && <p className="text-xs text-ink-500">{cliente.cpf.length === 14 ? "CNPJ" : "CPF"} {formatDocument(cliente.cpf)}</p>}
                    {/* Aponta o cliente pelo número do último pedido: o Atendimento
                        procura por todos os telefones e CPF/CNPJ dele. */}
                    {cliente.openLeads > 0 && (
                      <Link href={`/painel/atendimento?aba=todos&cliente=${encodeURIComponent(cliente.lastOrderNumber)}`} className="text-xs font-bold text-orange-700 hover:underline">
                        {cliente.openLeads} atendimento(s) em aberto
                      </Link>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-ink-700">{cliente.phone ? formatPhone(cliente.phone) : <span className="text-ink-400">—</span>}</td>
                  <td className="py-3 pr-3">
                    <p className="font-bold">{cliente.ordersCount}</p>
                    {cliente.avgDaysBetween !== null && <p className="text-xs text-ink-500">a cada ~{cliente.avgDaysBetween} dia(s)</p>}
                  </td>
                  <td className="py-3 pr-3 font-black">{formatPrice(cliente.totalCents)}</td>
                  <td className="py-3 pr-3">
                    <p>{DATA.format(new Date(cliente.lastOrderAt))}</p>
                    <p className="text-xs text-ink-500">{haDias(cliente.daysSinceLastOrder)} · {cliente.lastOrderNumber}</p>
                  </td>
                  <td className="py-3 pr-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${COR_DO_SEGMENTO[cliente.segment]}`}>{CUSTOMER_SEGMENT_LABELS[cliente.segment]}</span></td>
                  <td className="py-3"><AcoesDoCliente cliente={cliente} volta={volta} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visiveis.length && (
            <p className="py-10 text-center text-sm text-ink-500">
              {todos.length ? "Nenhum cliente corresponde aos filtros." : "Nenhum cliente com compra finalizada e telefone ou CPF ainda."}
            </p>
          )}
        </div>
      </PanelCard>
    </>
  );
}

/**
 * "Abrir WhatsApp" (quando há telefone), "Ver pedidos" → lista de pedidos
 * filtrada pelo cliente, e a recusa de recontato.
 *
 * Quem pediu para não ser chamado perde o botão de mensagem pronta de
 * recontato — a conversa com ele, se ele mesmo chamar, continua pelo
 * Atendimento. A marca é reversível ("Permitir recontato").
 */
function AcoesDoCliente({ cliente, volta }: { cliente: CustomerSummary; volta: string }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {cliente.contactOptOut
        ? null
        : cliente.phone
          ? <a href={customerWhatsappLink(cliente.phone, recompraMessage(cliente))} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#25D366] px-3 py-2 text-xs font-extrabold text-white hover:bg-[#20bd5a]">Abrir WhatsApp</a>
          : <span className="px-1 py-2 text-xs text-ink-400">Sem telefone</span>}
      {/* Pelo número do último pedido, não pelo telefone ou CPF: Pedidos acha o
          cliente dele e traz todos os pedidos, com qualquer telefone ou CPF. */}
      <Link href={`/painel/pedidos?cliente=${encodeURIComponent(cliente.lastOrderNumber)}`} className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-extrabold text-ink-800 hover:border-gold-400">Ver pedidos</Link>
      <form action={customerContactAction}>
        <input type="hidden" name="cliente" value={cliente.lastOrderNumber} />
        <input type="hidden" name="contato" value={cliente.contactOptOut ? "permitir" : "recusar"} />
        <input type="hidden" name="volta" value={volta} />
        <button
          type="submit"
          title={cliente.contactOptOut
            ? "O cliente voltou a aceitar o contato pós-compra"
            : "O cliente pediu para não receber o contato pós-compra: some das sugestões de recontato"}
          className={cliente.contactOptOut
            ? "rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-extrabold text-ink-800 hover:border-gold-400"
            : "rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-extrabold text-red-700 hover:border-red-300"}
        >
          {cliente.contactOptOut ? "Permitir recontato" : "Não quer recontato"}
        </button>
      </form>
    </div>
  );
}

function regraDoSegmento(segmento: CustomerSegment): string {
  if (segmento === "new") return "1 compra finalizada";
  if (segmento === "returning") return `${RETURNING_MIN_ORDERS} compras ou mais, abaixo do VIP`;
  if (segmento === "vip") return `${VIP_MIN_ORDERS} compras ou mais, ou ${formatPrice(VIP_MIN_TOTAL_CENTS)} em compras`;
  return `Sem comprar há mais de ${INACTIVE_AFTER_DAYS} dias`;
}

function dentroDaJanela(cliente: CustomerSummary, dias: FiltroDias): boolean {
  if (dias === "30") return cliente.daysSinceLastOrder <= 30;
  if (dias === "90") return cliente.daysSinceLastOrder <= 90;
  if (dias === "recontato") return cliente.daysSinceLastOrder >= REPURCHASE_MIN_DAYS && cliente.daysSinceLastOrder <= REPURCHASE_MAX_DAYS;
  return true;
}

function haDias(dias: number): string {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

function texto(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}
