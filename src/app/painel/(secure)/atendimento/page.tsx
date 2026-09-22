import Link from "next/link";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { LeadActions } from "@/components/admin/LeadActions";
import { LeadForm } from "@/components/admin/LeadForm";
import { requireOwner } from "@/lib/admin/auth";
import { getAdminProducts, getSalesOrders, getSellers } from "@/lib/admin/data";
import { countLeads, LEAD_LIST_LIMIT, leadCustomerKey, leadLocalDate, listLeadsPage, type LeadFilters, type LeadPage } from "@/lib/admin/leads";
import { sortSellers } from "@/lib/admin/sellers";
import { LEAD_KIND_LABELS, LEAD_STAGE_LABELS, type LeadRecord, type LeadStage, type SalesOrderRecord, type SellerRecord } from "@/lib/admin/types";
import { customerWhatsappLink } from "@/lib/services/whatsapp";
import { formatPhone } from "@/lib/utils/validators";

type Params = Record<string, string | string[] | undefined>;
type Aba = "fila" | "meus" | "todos";

const ABAS: Array<{ id: Aba; label: string }> = [
  { id: "fila", label: "Fila livre" },
  { id: "meus", label: "Meus atendimentos" },
  { id: "todos", label: "Todos" },
];

const FILTRO = "mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm";

/** Mesmos rótulos da lista de pedidos. */
const ROTULO_DO_PEDIDO: Record<SalesOrderRecord["status"], string> = {
  pending: "Aguardando confirmação",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

/**
 * ATENDIMENTO — quem está com quem.
 *
 * Todo contato que sai do site pelo WhatsApp cai aqui (a rota
 * /api/atendimentos/whatsapp registra antes de redirecionar), junto com os
 * pedidos do checkout (/api/pedidos cria o atendimento vinculado ao pedido) e
 * os atendimentos lançados a mão. As abas são conveniência: qualquer pessoa do
 * painel enxerga tudo, como o dono decidiu.
 */
export default async function AtendimentoPage({ searchParams }: { searchParams: Promise<Params> }) {
  const owner = await requireOwner();
  const params = await searchParams;

  // "Todos" é a aba de entrada: no modo padrão (o cliente escolhe com quem
  // falar) os cliques de WhatsApp já nascem com atendente — só os pedidos do
  // checkout e os lançamentos sem dono caem na fila —, então abrir na fila livre
  // mostraria uma tela quase vazia para quem tem dezenas de contatos gravados.
  const aba: Aba = params.aba === "fila" ? "fila" : params.aba === "meus" ? "meus" : "todos";
  const atendente = texto(params.atendente);
  const etapaBruta = texto(params.etapa);
  const etapa: LeadStage | "" = etapaBruta in LEAD_STAGE_LABELS ? (etapaBruta as LeadStage) : "";
  const origem = texto(params.origem);
  const de = dataValida(texto(params.de));
  const ate = dataValida(texto(params.ate));
  const query = texto(params.q).trim();
  const feito = texto(params.feito);
  const erro = texto(params.erro);

  // Cada aba é uma consulta PRÓPRIA, com os filtros aplicados no banco antes do
  // teto de 500 — e não um recorte em memória dos 500 mais recentes da loja.
  // Era isso que fazia a fila livre "esvaziar" com o tempo: um atendimento sem
  // dono de meses atrás ficava fora do recorte e sumia da aba. A fila não tem
  // corte de período implícito; só as datas que o operador escolher.
  //
  // O filtro de atendente não vale na fila (por definição, sem atendente) nem
  // em "Meus" (o atendente é o do login): nas duas o select fica desativado e o
  // valor é guardado para quando o operador voltar para "Todos".
  const filtrosDaLista: LeadFilters = {
    from: de || undefined,
    to: ate || undefined,
    q: query || undefined,
    stage: etapa || undefined,
    source: origem || undefined,
    ...(aba === "fila"
      ? { unassigned: true, open: true }
      : aba === "meus"
        ? { sellerId: owner.sellerId ?? undefined }
        : { sellerId: atendente || undefined }),
  };
  // Login sem vínculo não tem "meus": nem consulta (sem sellerId, a consulta
  // viraria "todos").
  const semVinculo = aba === "meus" && !owner.sellerId;
  const hoje = leadLocalDate(new Date().toISOString());

  const [pagina, sellers, produtos, pedidos, filaLivre, chegaramHoje] = await Promise.all([
    semVinculo ? Promise.resolve<LeadPage>({ leads: [], truncated: false }) : listLeadsPage(filtrosDaLista),
    getSellers(),
    getAdminProducts(),
    getSalesOrders(),
    // Números do topo: contagens exatas, independentes da aba e dos filtros.
    countLeads({ unassigned: true, open: true }),
    countLeads({ from: hoje, to: hoje }),
  ]);
  const atendentes = sortSellers(sellers);
  const ativos = atendentes.filter((seller) => seller.active);
  const abertosPorAtendente = await Promise.all(ativos.map((seller) => countLeads({ sellerId: seller.id, open: true })));
  const porId = new Map(sellers.map((seller) => [seller.id, seller]));
  const nomeDoProduto = new Map(produtos.map((produto) => [produto.id, produto.name]));
  const pedidoPorId = new Map(pedidos.map((pedido) => [pedido.id, pedido]));
  const leads = pagina.leads;

  // Filtros (sem a aba e sem as mensagens) viajam nos links das abas e na volta
  // das ações, senão cada clique jogaria o operador de volta para a lista cheia.
  const filtros = new URLSearchParams();
  for (const [chave, valor] of [["atendente", atendente], ["etapa", etapa], ["origem", origem], ["de", de], ["ate", ate], ["q", query]] as const) {
    if (valor) filtros.set(chave, valor);
  }
  const volta = comFiltros(aba, filtros);
  // A origem escolhida continua na lista mesmo quando o filtro a deixa como a
  // única presente — senão o select não mostraria o valor aplicado.
  const origens = [...new Set([...leads.map((lead) => lead.source), ...(origem ? [origem] : [])])].sort();
  const atendenteDesativado = aba !== "todos";

  return (
    <>
      <AdminPageHeader
        eyebrow="Operação comercial"
        title="Atendimento"
        description={`${leads.length}${pagina.truncated ? "+" : ""} atendimento(s) nesta lista · ${filaLivre} na fila livre`}
        actions={<Link href="/painel/pedidos" className="rounded-lg border border-ink-300 bg-white px-4 py-2.5 text-sm font-extrabold text-ink-800">Ver pedidos</Link>}
      />

      {feito && <div role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{feito}</div>}
      {erro && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {pagina.truncated && (
        <div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Mostrando os {LEAD_LIST_LIMIT} atendimentos mais recentes desta lista. Os números do topo contam todos; para alcançar os anteriores, filtre por atendente, etapa, origem ou data — a busca por texto procura só dentro destes {LEAD_LIST_LIMIT}.
        </div>
      )}

      {/* Contagens exatas, feitas no banco: não dependem da aba, dos filtros nem
          do teto da lista. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PanelCard className="p-4">
          <p className="text-xs font-semibold text-ink-500">Fila livre</p>
          <p className="mt-2 text-3xl font-black text-orange-700">{filaLivre}</p>
        </PanelCard>
        <PanelCard className="p-4">
          <p className="text-xs font-semibold text-ink-500">Chegaram hoje</p>
          <p className="mt-2 text-3xl font-black text-blue-700">{chegaramHoje}</p>
        </PanelCard>
        {ativos.map((seller, indice) => (
          <PanelCard key={seller.id} className="p-4">
            <p className="text-xs font-semibold text-ink-500">{seller.name} · em aberto</p>
            <p className="mt-2 text-3xl font-black text-ink-900">{abertosPorAtendente[indice] ?? 0}</p>
          </PanelCard>
        ))}
      </div>

      <nav aria-label="Abas de atendimento" className="mt-5 flex flex-wrap gap-2">
        {ABAS.map((item) => (
          <Link
            key={item.id}
            href={comFiltros(item.id, filtros)}
            aria-current={aba === item.id ? "page" : undefined}
            className={`rounded-lg px-4 py-2.5 text-sm font-extrabold transition-colors ${aba === item.id ? "bg-ink-900 text-white" : "border border-ink-200 bg-white text-ink-700 hover:border-gold-400"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {aba === "meus" && !owner.sellerId && (
        <div role="alert" className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Este login ainda não está vinculado a um atendente, então “Meus atendimentos” fica vazio. Vincule com: <code>npm run criar:usuario -- {owner.id} --vendedor &lt;atendente&gt;</code>
        </div>
      )}

      <PanelCard className="mt-5">
        {/* flex-wrap em vez do grid fixo dos pedidos: a lista de origens cresce
            quando o controle de tráfego entrar, e uma coluna a mais não pode
            quebrar a linha dos filtros. */}
        <form className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="aba" value={aba} />
          <label className="min-w-[200px] flex-1 text-xs font-bold text-ink-600">Buscar<input name="q" defaultValue={query} placeholder="Cliente, telefone ou mensagem" className={FILTRO} /></label>
          <label className="w-40 text-xs font-bold text-ink-600">Atendente
            <select
              name="atendente"
              defaultValue={atendente}
              disabled={atendenteDesativado}
              title={aba === "fila"
                ? "A fila livre é, por definição, o que ainda não tem atendente."
                : aba === "meus"
                  ? "Em “Meus atendimentos” o atendente é o do seu login."
                  : undefined}
              className={`${FILTRO} disabled:bg-ink-50 disabled:text-ink-400`}
            >
              <option value="">Todos</option>
              {atendentes.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
            </select>
          </label>
          {/* Campo desativado não vai no envio: sem esta cópia, filtrar na fila
              apagaria o atendente escolhido antes, e voltar para "Todos" não o
              traria de volta. */}
          {atendenteDesativado && atendente && <input type="hidden" name="atendente" value={atendente} />}
          <label className="w-44 text-xs font-bold text-ink-600">Etapa
            <select name="etapa" defaultValue={etapa} className={FILTRO}>
              <option value="">Todas</option>
              {Object.entries(LEAD_STAGE_LABELS).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
          </label>
          <label className="w-40 text-xs font-bold text-ink-600">Origem
            <select name="origem" defaultValue={origem} className={FILTRO}>
              <option value="">Todas</option>
              {origens.map((valor) => <option key={valor} value={valor}>{rotuloOrigem(valor)}</option>)}
            </select>
          </label>
          <label className="w-36 text-xs font-bold text-ink-600">De<input type="date" name="de" defaultValue={de} className={FILTRO} /></label>
          <label className="w-36 text-xs font-bold text-ink-600">Até<input type="date" name="ate" defaultValue={ate} className={FILTRO} /></label>
          <button className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-bold text-white">Filtrar</button>
        </form>
      </PanelCard>

      {/* `details` em vez de estado no cliente: o formulário é uso eventual e
          não precisa ocupar a tela de quem só veio ver a fila. */}
      <details className="mt-5 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
        <summary className="cursor-pointer px-5 py-4 text-sm font-extrabold text-blue-700 hover:bg-blue-50">+ Atendimento manual</summary>
        <div className="border-t border-ink-100 p-5">
          <p className="mb-4 text-sm text-ink-500">Para quem chegou pela loja física, por indicação ou num WhatsApp que não passou pelo site.</p>
          <LeadForm sellers={atendentes} ownerSellerId={owner.sellerId} />
        </div>
      </details>

      <div className="mt-5 space-y-3">
        {leads.map((lead) => (
          <LeadRow
            key={lead.id}
            lead={lead}
            seller={lead.seller_id ? porId.get(lead.seller_id) ?? null : null}
            productName={lead.product_id ? nomeDoProduto.get(lead.product_id) ?? lead.product_id : ""}
            order={lead.order_id ? pedidoPorId.get(lead.order_id) ?? null : null}
            sellers={atendentes}
            ownerSellerId={owner.sellerId}
            volta={volta}
          />
        ))}
        {!leads.length && (
          <PanelCard>
            <p className="py-10 text-center text-sm text-ink-500">
              {aba === "fila" ? "Nenhum atendimento esperando na fila." : "Nenhum atendimento corresponde aos filtros."}
            </p>
          </PanelCard>
        )}
      </div>
    </>
  );
}

function LeadRow({ lead, seller, productName, order, sellers, ownerSellerId, volta }: {
  lead: LeadRecord;
  seller: SellerRecord | null;
  productName: string;
  /** Pedido vinculado (`lead.order_id`), quando ainda está na lista de pedidos. */
  order: SalesOrderRecord | null;
  sellers: SellerRecord[];
  ownerSellerId: string | null;
  volta: string;
}) {
  const telefone = telefoneVisivel(lead.customer_phone);
  // Atendente fora do cadastro atual (removido da lista) ainda é alguém: mostrar
  // o id é melhor do que dizer "Fila livre" para um atendimento que tem dono.
  const responsavel = lead.seller_id ? seller?.name ?? lead.seller_id : null;
  return (
    <article className="rounded-2xl border border-ink-100 bg-white shadow-card">
      <div className="grid gap-4 p-5 sm:grid-cols-[1.4fr_1fr] sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-black text-ink-900">{lead.customer_name || "Cliente não identificado"}</h2>
            <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[10px] font-black uppercase text-ink-600">{LEAD_KIND_LABELS[lead.kind]}</span>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700">{LEAD_STAGE_LABELS[lead.stage]}</span>
            <span className="rounded-full bg-ink-50 px-2.5 py-1 text-[10px] font-black uppercase text-ink-500">{rotuloOrigem(lead.source)}</span>
          </div>
          {telefone
            ? <a href={customerWhatsappLink(lead.customer_phone)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-bold text-[#128C7E] hover:underline">{telefone} · abrir WhatsApp</a>
            : <p className="mt-1 text-sm text-ink-400">Sem telefone registrado</p>}
          {lead.message && <p className="mt-2 line-clamp-2-safe text-xs text-ink-500">{lead.message}</p>}
          {lead.notes && <p className="mt-2 text-xs text-ink-600"><strong>Obs.:</strong> {lead.notes}</p>}
        </div>

        <div className="text-sm">
          <p className={responsavel ? "font-bold text-ink-900" : "font-bold text-orange-700"}>{responsavel ?? "Fila livre"}</p>
          <p className="mt-1 text-xs text-ink-500">{tempoRelativo(lead.created_at)} · {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(lead.created_at))}</p>
          {lead.order_id && (order
            ? (
              <p className="mt-1 text-xs text-ink-600">
                {/* A busca de /painel/pedidos procura pelo número: o link abre a
                    lista já filtrada nesse pedido. */}
                <Link href={`/painel/pedidos?q=${encodeURIComponent(order.number)}`} className="font-bold text-blue-700 hover:underline">
                  Pedido {order.number}
                </Link>
                {" · "}{ROTULO_DO_PEDIDO[order.status]}
              </p>
            )
            : <p className="mt-1 text-xs text-ink-400">O pedido vinculado não está mais na lista de pedidos.</p>)}
          {productName && <p className="mt-1 text-xs text-ink-500">Produto: {productName}</p>}
          {lead.items.length > 0 && <p className="mt-1 text-xs text-ink-500">{lead.items.map((item) => `${item.quantity}x ${item.product_name}`).join(", ")}</p>}
          {lead.page_path && <p className="mt-1 text-xs text-ink-400">Veio de {lead.page_path}</p>}
        </div>
      </div>

      <div className="border-t border-ink-100 bg-ink-50/50 px-5 py-3">
        <LeadActions leadId={lead.id} currentSellerId={lead.seller_id} sellers={sellers} ownerSellerId={ownerSellerId} volta={volta} />
      </div>
    </article>
  );
}

function comFiltros(aba: Aba, filtros: URLSearchParams): string {
  const params = new URLSearchParams(filtros);
  params.set("aba", aba);
  return `/painel/atendimento?${params.toString()}`;
}

function texto(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function dataValida(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

/**
 * Rótulo da origem. Hoje todo atendimento nasce "direto"; quando o controle de
 * tráfego classificar Instagram, Google e campanhas, os valores novos aparecem
 * aqui sozinhos (e ganham rótulo próprio na mesma tabela de labels).
 */
function rotuloOrigem(source: string): string {
  return source === "direct" ? "Direto" : source;
}

/** Telefone do cliente já sem o DDI, do jeito que a loja digita. */
function telefoneVisivel(phone: string): string {
  const nacional = leadCustomerKey(phone);
  return nacional.length === 10 || nacional.length === 11 ? formatPhone(nacional) : nacional;
}

function tempoRelativo(iso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutos < 1) return "agora mesmo";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}
