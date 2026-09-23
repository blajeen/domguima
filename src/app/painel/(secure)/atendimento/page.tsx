import Link from "next/link";
import { identifyLeadCustomerAction, linkLeadToOrderAction } from "@/app/painel/actions";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { CrmMigrationNotice } from "@/components/admin/CrmMigrationNotice";
import { LeadActions } from "@/components/admin/LeadActions";
import { LeadForm } from "@/components/admin/LeadForm";
import { LeadStageSelect } from "@/components/admin/LeadStageSelect";
import { requireOwner } from "@/lib/admin/auth";
import { adminConfig } from "@/lib/admin/config";
import { buildCustomerIndex, recurrenceBadge, type CustomerIndex } from "@/lib/admin/customers";
import { getAdminProducts, getSalesOrders, getSellers } from "@/lib/admin/data";
import { countLeads, LEAD_LIST_LIMIT, leadCustomerKey, leadLocalDate, listLeadsPage, type LeadFilters, type LeadPage } from "@/lib/admin/leads";
import { sortSellers } from "@/lib/admin/sellers";
import {
  LEAD_KIND_LABELS,
  LEAD_LOST_REASON_LABELS,
  LEAD_STAGE_LABELS,
  LEAD_STAGES,
  OPEN_LEAD_STAGES,
  TRAFFIC_SOURCE_LABELS,
  type LeadRecord,
  type LeadStage,
  type SalesOrderRecord,
  type SellerRecord,
} from "@/lib/admin/types";
import { latestCampaign, trafficSourceLabel } from "@/lib/services/origem";
import { customerWhatsappLink } from "@/lib/services/whatsapp";
import { formatDocument, formatPhone, onlyDigits } from "@/lib/utils/validators";

type Params = Record<string, string | string[] | undefined>;
type Aba = "fila" | "meus" | "todos";

const ABAS: Array<{ id: Aba; label: string }> = [
  { id: "fila", label: "Fila livre" },
  { id: "meus", label: "Meus atendimentos" },
  { id: "todos", label: "Todos" },
];

const FILTRO = "mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm";
const BOTAO = "rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-extrabold text-ink-800 transition-colors hover:border-gold-400";
const CAMPO_PEQUENO = "mt-1 block rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs font-normal text-ink-900";
const PERCENTUAL = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

/** Mesmos rótulos da lista de pedidos. */
const ROTULO_DO_PEDIDO: Record<SalesOrderRecord["status"], string> = {
  pending: "Aguardando confirmação",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

/** Cor da etiqueta de cada etapa: azul no começo do funil, verde/vermelho no fim. */
const COR_DA_ETAPA: Record<LeadStage, string> = {
  new: "bg-blue-50 text-blue-700",
  in_progress: "bg-indigo-50 text-indigo-700",
  quote_sent: "bg-amber-50 text-amber-800",
  awaiting_payment: "bg-orange-50 text-orange-700",
  won: "bg-green-50 text-green-700",
  lost: "bg-red-50 text-red-700",
};

/**
 * ATENDIMENTO — quem está com quem, e em que ponto está cada conversa.
 *
 * Todo contato que sai do site pelo WhatsApp cai aqui (a rota
 * /api/atendimentos/whatsapp registra antes de redirecionar), junto com os
 * pedidos do checkout (/api/pedidos cria o atendimento vinculado ao pedido) e
 * os atendimentos lançados a mão. As abas são conveniência: qualquer pessoa do
 * painel enxerga tudo, como o dono decidiu.
 *
 * Cada atendimento anda pelo funil (Novo → Em atendimento → Orçamento enviado →
 * Aguardando pagamento → Ganho ou Perdido). As etapas são do ATENDIMENTO; o
 * pedido continua com os próprios status, e confirmar ou cancelar o pedido
 * fecha o atendimento vinculado sozinho.
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
  // Cliente apontado por um link da tela de Clientes: vem pelo número de um
  // pedido dele, nunca pelo telefone ou CPF (que ficariam na URL).
  const clienteRef = texto(params.cliente).trim();
  const feito = texto(params.feito);
  const erro = texto(params.erro);

  // Os pedidos vêm antes dos atendimentos: são eles que dizem quem é quem
  // (etiqueta de recorrência e o filtro por cliente logo abaixo).
  const [sellers, produtos, pedidos] = await Promise.all([getSellers(), getAdminProducts(), getSalesOrders()]);
  const clientes = buildCustomerIndex(pedidos);
  const chaveDoLink = clienteRef ? clientes.keyOfOrderNumber(clienteRef) : null;

  // Cada aba é uma consulta PRÓPRIA, com os filtros aplicados no banco antes do
  // teto de 500 — e não um recorte em memória dos 500 mais recentes da loja.
  // Era isso que fazia a fila livre "esvaziar" com o tempo: um atendimento sem
  // dono de meses atrás ficava fora do recorte e sumia da aba. A fila não tem
  // corte de período implícito; só as datas que o operador escolher.
  //
  // O filtro de atendente não vale na fila (por definição, sem atendente) nem
  // em "Meus" (o atendente é o do login): nas duas o select fica desativado e o
  // valor é guardado para quando o operador voltar para "Todos".
  //
  // O funil conta com os mesmos filtros, menos a etapa (é ela que o funil
  // separa) e a busca por texto (que só existe em memória, sobre a lista).
  const filtrosDoFunil: Omit<LeadFilters, "q" | "stage"> = {
    from: de || undefined,
    to: ate || undefined,
    source: origem || undefined,
    // Todos os telefones e CPF/CNPJ do cliente: o atendimento pode ter vindo
    // de um número antigo dele. Cliente do link não encontrado = lista vazia.
    ...(clienteRef ? { customerKeys: clientes.identitiesOf(chaveDoLink) } : {}),
    ...(aba === "fila"
      ? { unassigned: true, open: true }
      : aba === "meus"
        ? { sellerId: owner.sellerId ?? undefined }
        : { sellerId: atendente || undefined }),
  };
  const filtrosDaLista: LeadFilters = { ...filtrosDoFunil, q: query || undefined, stage: etapa || undefined };
  // Login sem vínculo não tem "meus": nem consulta (sem sellerId, a consulta
  // viraria "todos").
  const semVinculo = aba === "meus" && !owner.sellerId;
  const hoje = leadLocalDate(new Date().toISOString());
  // Na fila só existem etapas abertas: Ganho e Perdido ficariam sempre em zero.
  const etapasDoFunil: readonly LeadStage[] = aba === "fila" ? OPEN_LEAD_STAGES : LEAD_STAGES;

  const [pagina, filaLivre, chegaramHoje] = await Promise.all([
    semVinculo ? Promise.resolve<LeadPage>({ leads: [], truncated: false }) : listLeadsPage(filtrosDaLista),
    // Números do topo: contagens exatas, independentes da aba e dos filtros.
    countLeads({ unassigned: true, open: true }),
    countLeads({ from: hoje, to: hoje }),
  ]);
  const atendentes = sortSellers(sellers);
  const ativos = atendentes.filter((seller) => seller.active);
  const [abertosPorAtendente, porEtapa] = await Promise.all([
    Promise.all(ativos.map((seller) => countLeads({ sellerId: seller.id, open: true }))),
    Promise.all(etapasDoFunil.map((valor) => (semVinculo ? Promise.resolve(0) : countLeads({ ...filtrosDoFunil, stage: valor })))),
  ]);
  const contagemDaEtapa = new Map(etapasDoFunil.map((valor, indice) => [valor, porEtapa[indice] ?? 0]));
  const ganhos = contagemDaEtapa.get("won") ?? 0;
  const perdidos = contagemDaEtapa.get("lost") ?? 0;
  const taxaDeGanho = aba !== "fila" && ganhos + perdidos > 0 ? ganhos / (ganhos + perdidos) : null;

  const porId = new Map(sellers.map((seller) => [seller.id, seller]));
  const nomeDoProduto = new Map(produtos.map((produto) => [produto.id, produto.name]));
  const pedidoPorId = new Map(pedidos.map((pedido) => [pedido.id, pedido]));
  const leads = pagina.leads;

  // Filtros (sem a aba e sem as mensagens) viajam nos links das abas e na volta
  // das ações, senão cada clique jogaria o operador de volta para a lista cheia.
  const filtros = new URLSearchParams();
  for (const [chave, valor] of [["atendente", atendente], ["etapa", etapa], ["origem", origem], ["de", de], ["ate", ate], ["q", query], ["cliente", clienteRef]] as const) {
    if (valor) filtros.set(chave, valor);
  }
  const volta = comFiltros(aba, filtros);
  const semCliente = new URLSearchParams(filtros);
  semCliente.delete("cliente");
  const comEtapa = (valor: LeadStage | "") => {
    const proximos = new URLSearchParams(filtros);
    if (valor) proximos.set("etapa", valor);
    else proximos.delete("etapa");
    return comFiltros(aba, proximos);
  };
  // Todas as origens conhecidas, mais qualquer valor antigo fora da lista que
  // esteja gravado (ou no filtro aplicado) — senão o select não o mostraria.
  const origens = [...new Set([...Object.keys(TRAFFIC_SOURCE_LABELS), ...leads.map((lead) => lead.source), ...(origem ? [origem] : [])])];
  const atendenteDesativado = aba !== "todos";
  const contaDoAmbiente = Boolean(adminConfig.username) && owner.id.toLowerCase() === adminConfig.username.toLowerCase();

  return (
    <>
      <AdminPageHeader
        eyebrow="Operação comercial"
        title="Atendimento"
        description={`${leads.length}${pagina.truncated ? "+" : ""} atendimento(s) nesta lista · ${filaLivre} na fila livre`}
        actions={<>
          <Link href="/painel/clientes" className="rounded-lg border border-ink-300 bg-white px-4 py-2.5 text-sm font-extrabold text-ink-800">Clientes</Link>
          <Link href="/painel/pedidos" className="rounded-lg border border-ink-300 bg-white px-4 py-2.5 text-sm font-extrabold text-ink-800">Ver pedidos</Link>
        </>}
      />

      {/* Sem a tabela de atendimentos a lista abaixo viria vazia, como se não
          houvesse contato nenhum: o aviso diz que é o banco que falta. */}
      <CrmMigrationNotice />
      {feito && <div role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{feito}</div>}
      {erro && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {clienteRef && (
        <div role="status" className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {chaveDoLink
            ? `Mostrando só os atendimentos do cliente do pedido ${clienteRef}, com qualquer telefone ou CPF dele.`
            : `Nenhum cliente encontrado para o pedido ${clienteRef}.`}
          {" "}<Link href={comFiltros(aba, semCliente)} className="font-bold underline">Ver todos os atendimentos</Link>
        </div>
      )}
      {pagina.truncated && (
        <div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Mostrando os {LEAD_LIST_LIMIT} atendimentos mais recentes desta lista. Os números do topo e do funil contam todos; para alcançar os anteriores, filtre por atendente, etapa, origem ou data — a busca por texto procura só dentro destes {LEAD_LIST_LIMIT}.
        </div>
      )}

      {/* Contagens exatas, feitas no banco: não dependem da aba, dos filtros nem
          do teto da lista. "Em aberto" é o mesmo número que o modo "menos
          ocupado" usa para escolher quem recebe o próximo atendimento. */}
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
        <div role="alert" className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-800">
          {/* A conta do ambiente (ADMIN_USERNAME) não mora na tabela de
              usuários: vinculá-la cria a linha, e a senha do banco passa a
              valer no lugar da do ambiente — por isso a CLI exige --senha. */}
          {contaDoAmbiente ? (
            <>
              Este é o login do ambiente (ADMIN_USERNAME) e ele não tem atendente, então “Meus atendimentos” fica vazio. Para vincular, ele precisa virar usuário do banco, com a senha que vai valer dali em diante (pode ser a mesma de hoje):{" "}
              <code className="break-all">npm run criar:usuario -- {owner.id} &quot;Seu nome&quot; --vendedor &lt;atendente&gt; --senha &quot;…&quot;</code>.
            </>
          ) : (
            <>
              Este login ainda não está vinculado a um atendente, então “Meus atendimentos” fica vazio. Vincule no terminal com{" "}
              <code className="break-all">npm run criar:usuario -- {owner.id} --vendedor &lt;atendente&gt;</code> — a senha e o nome continuam os mesmos.
            </>
          )}{" "}
          O vínculo vai dentro da sessão: depois do comando, saia e entre de novo no painel.
        </div>
      )}

      {/* Mini-funil: quantos atendimentos há em cada etapa com os filtros de
          agora. Cada etapa é um atalho para filtrar a lista por ela. */}
      <PanelCard className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-black text-ink-900">Funil</h2>
          <p className="text-xs text-ink-500">
            {taxaDeGanho === null
              ? "Com a aba e os filtros atuais (a busca por texto não entra na conta)."
              : <>Ganhos: <strong className="text-green-700">{PERCENTUAL.format(taxaDeGanho)}</strong> dos {ganhos + perdidos} atendimento(s) fechados · com a aba e os filtros atuais (a busca por texto não entra na conta).</>}
          </p>
        </div>
        <ol className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {etapasDoFunil.map((valor, indice) => (
            <li key={valor} className="flex items-center gap-2">
              {indice > 0 && <span aria-hidden="true" className="font-bold text-ink-300">{valor === "lost" ? "ou" : "→"}</span>}
              <Link
                href={comEtapa(etapa === valor ? "" : valor)}
                aria-current={etapa === valor ? "true" : undefined}
                title={etapa === valor ? "Mostrar todas as etapas" : `Mostrar só “${LEAD_STAGE_LABELS[valor]}”`}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-bold transition-colors ${etapa === valor ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-700 hover:border-gold-400"}`}
              >
                {LEAD_STAGE_LABELS[valor]}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${etapa === valor ? "bg-white/15" : COR_DA_ETAPA[valor]}`}>{contagemDaEtapa.get(valor) ?? 0}</span>
              </Link>
            </li>
          ))}
          {etapa && <li><Link href={comEtapa("")} className="ml-1 font-bold text-blue-700 hover:underline">Todas as etapas</Link></li>}
        </ol>
      </PanelCard>

      <PanelCard className="mt-5">
        {/* flex-wrap em vez de grade fixa: com a origem e as datas são seis
            campos, e uma coluna a mais não pode quebrar a linha dos filtros. */}
        <form className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="aba" value={aba} />
          {clienteRef && <input type="hidden" name="cliente" value={clienteRef} />}
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
              {LEAD_STAGES.map((valor) => <option key={valor} value={valor}>{LEAD_STAGE_LABELS[valor]}</option>)}
            </select>
          </label>
          <label className="w-40 text-xs font-bold text-ink-600">Origem
            <select name="origem" defaultValue={origem} className={FILTRO}>
              <option value="">Todas</option>
              {origens.map((valor) => <option key={valor} value={valor}>{trafficSourceLabel(valor)}</option>)}
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
            clientes={clientes}
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

function LeadRow({ lead, seller, productName, order, clientes, sellers, ownerSellerId, volta }: {
  lead: LeadRecord;
  seller: SellerRecord | null;
  productName: string;
  /** Pedido vinculado (`lead.order_id`), quando ainda está na lista de pedidos. */
  order: SalesOrderRecord | null;
  /** Quem é quem pelos pedidos (telefone e CPF de cada cliente e as compras dele). */
  clientes: CustomerIndex;
  sellers: SellerRecord[];
  ownerSellerId: string | null;
  volta: string;
}) {
  // O vínculo não copia nome nem telefone do pedido para o atendimento (ver
  // linkLeadToOrder): enquanto o pedido existir, a tela mostra os dele.
  const nome = lead.customer_name || order?.customer?.name?.trim() || "";
  const telefoneDoCliente = lead.customer_phone || onlyDigits(order?.customer?.phone ?? "");
  const telefone = telefoneVisivel(telefoneDoCliente);
  // Atendente fora do cadastro atual (removido da lista) ainda é alguém: mostrar
  // o id é melhor do que dizer "Fila livre" para um atendimento que tem dono.
  const responsavel = lead.seller_id ? seller?.name ?? lead.seller_id : null;
  // A campanha mais recente é a que o cliente acabou de clicar — a mesma que
  // foi no "(ref. ...)" da mensagem do WhatsApp.
  const campanha = latestCampaign(lead.attribution);
  // Clique de WhatsApp não traz telefone: a etiqueta de recorrência só aparece
  // quando há como reconhecer o cliente (telefone/CPF do atendimento ou do
  // pedido vinculado). "Recorrente" = já tinha compra finalizada ANTES: da
  // compra, quando o pedido vinculado foi finalizado (ela mesma não conta);
  // senão, da chegada do atendimento.
  const chaveDoCliente = clientes.keyOf(lead.customer_key) ?? (order ? clientes.keyOfOrder(order) : null);
  const momento = order?.status === "completed" ? order.created_at : lead.created_at;
  const selo = lead.customer_key || chaveDoCliente
    ? recurrenceBadge(clientes.completedBefore(chaveDoCliente, momento), clientes.completedOrders(chaveDoCliente))
    : null;
  // O link aponta o cliente pelo número de um pedido dele, não pelo telefone.
  const referencia = clientes.referenceOf(chaveDoCliente);
  // Pedido já confirmado prende a etapa em Ganho (a venda aconteceu). Se o
  // atendimento ainda não está em Ganho — o fechamento automático da
  // confirmação falhou —, a única troca aceita é para Ganho, e o operador
  // acerta por aqui. Sem pedido, ou com o pedido cancelado/fora da lista, o
  // atendimento pode ganhar outro vínculo.
  const pedidoConfirmado = order?.status === "completed" ? order : null;
  const travado = pedidoConfirmado && lead.stage === "won" ? `Pedido ${pedidoConfirmado.number} confirmado: a etapa fica Ganho.` : undefined;
  const acertarParaGanho = pedidoConfirmado && lead.stage !== "won" ? `Pedido ${pedidoConfirmado.number} já confirmado: salve como Ganho.` : undefined;
  const podeVincular = !lead.order_id || !order || order.status === "cancelled";
  // Chave gravada sem telefone = veio do CPF/CNPJ (é a regra de customerKey).
  const documentoDoLead = !lead.customer_phone && lead.customer_key && (lead.customer_key.length === 11 || lead.customer_key.length === 14)
    ? formatDocument(lead.customer_key)
    : "";
  const podeLancar = podeVincular && lead.stage !== "lost";

  return (
    <article className="rounded-2xl border border-ink-100 bg-white shadow-card">
      <div className="grid gap-4 p-5 sm:grid-cols-[1.4fr_1fr] sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-black text-ink-900">{nome || "Cliente não identificado"}</h2>
            <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[10px] font-black uppercase text-ink-600">{LEAD_KIND_LABELS[lead.kind]}</span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${COR_DA_ETAPA[lead.stage]}`}>
              {LEAD_STAGE_LABELS[lead.stage]}{lead.stage === "lost" && lead.lost_reason ? ` · ${LEAD_LOST_REASON_LABELS[lead.lost_reason]}` : ""}
            </span>
            {selo && (selo.returning && referencia
              ? <Link href={`/painel/clientes?cliente=${encodeURIComponent(referencia)}`} title="Ver o histórico deste cliente" className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700 hover:underline">{selo.label}</Link>
              : <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase text-sky-700">{selo.label}</span>)}
            <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-black uppercase text-purple-700">{trafficSourceLabel(lead.source)}</span>
            {campanha && <span className="rounded-full bg-gold-50 px-2.5 py-1 text-[10px] font-black text-gold-800" title="Campanha (utm_campaign) do link por onde o cliente chegou">Campanha: {campanha}</span>}
          </div>
          {telefone
            ? <a href={customerWhatsappLink(telefoneDoCliente)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-bold text-[#128C7E] hover:underline">{telefone} · abrir WhatsApp</a>
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

      <div className="space-y-3 border-t border-ink-100 bg-ink-50/50 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* `key` pela etapa gravada: depois de salvar, a página volta só com a
              query nova e o Next não remonta a árvore — sem remontar, o select
              guardaria o estado local antigo em vez da etapa que veio do banco. */}
          <LeadStageSelect
            key={`${lead.id}:${lead.stage}:${lead.lost_reason ?? ""}:${pedidoConfirmado ? "confirmado" : ""}`}
            leadId={lead.id}
            stage={lead.stage}
            lostReason={lead.lost_reason}
            volta={volta}
            lockedReason={travado}
            allowedStages={acertarParaGanho ? ["won"] : undefined}
            note={acertarParaGanho}
          />
          <LeadActions leadId={lead.id} currentSellerId={lead.seller_id} sellers={sellers} ownerSellerId={ownerSellerId} volta={volta} />
        </div>
        {podeVincular && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Formulários irmãos, nunca aninhados: o de etapa e os de
                redistribuição ficam na linha de cima. */}
            <form action={linkLeadToOrderAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="leadId" value={lead.id} />
              <input type="hidden" name="volta" value={volta} />
              <input
                name="orderNumber"
                required
                maxLength={40}
                aria-label="Número do pedido para vincular a este atendimento"
                placeholder="Vincular a pedido: DG-…"
                className="w-56 rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs"
              />
              <button type="submit" className={BOTAO}>Vincular</button>
            </form>
            {podeLancar && (
              <Link href={`/painel/pedidos/novo?atendimento=${encodeURIComponent(lead.id)}&volta=${encodeURIComponent(volta)}`} className={BOTAO}>
                Lançar pedido
              </Link>
            )}
          </div>
        )}
        {/* Com pedido vinculado, quem o cliente é vem do pedido (e editar é lá):
            copiar telefone e CPF para cá deixaria dados pessoais para trás
            quando o pedido fosse excluído. */}
        {!order && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-extrabold text-blue-700 hover:underline">
              {lead.customer_key ? "Corrigir dados do cliente" : "Identificar cliente (telefone ou CPF da conversa)"}
            </summary>
            <form action={identifyLeadCustomerAction} className="mt-2 flex flex-wrap items-end gap-2">
              <input type="hidden" name="leadId" value={lead.id} />
              <input type="hidden" name="volta" value={volta} />
              <label className="text-[11px] font-bold text-ink-600">Nome
                <input name="customerName" defaultValue={lead.customer_name} maxLength={140} autoComplete="off" className={`${CAMPO_PEQUENO} w-48`} />
              </label>
              <label className="text-[11px] font-bold text-ink-600">Telefone com DDD
                <input name="customerPhone" defaultValue={telefone} inputMode="tel" maxLength={20} autoComplete="off" placeholder="(34) 99999-9999" className={`${CAMPO_PEQUENO} w-40`} />
              </label>
              <label className="text-[11px] font-bold text-ink-600">CPF/CNPJ (se não houver telefone)
                <input name="customerDocument" defaultValue={documentoDoLead} inputMode="numeric" maxLength={20} autoComplete="off" className={`${CAMPO_PEQUENO} w-44`} />
              </label>
              <button type="submit" className={BOTAO}>Salvar</button>
            </form>
            <p className="mt-1.5 text-[11px] text-ink-500">Com o telefone ou o CPF, o atendimento passa a mostrar se o cliente já comprou e entra no aviso de atendimento em aberto em Clientes.</p>
          </details>
        )}
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
