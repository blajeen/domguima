import Link from "next/link";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { CampaignLinkBuilder, type LinkDestinationGroup } from "@/components/admin/CampaignLinkBuilder";
import { CrmMigrationNotice } from "@/components/admin/CrmMigrationNotice";
import { site } from "@/config/site";
import { requireOwner } from "@/lib/admin/auth";
import { readCatalogState } from "@/lib/admin/catalog-store";
import { getAdminCategories, getAdminProducts } from "@/lib/admin/data";
import { LEAD_REPORT_LIMIT, listLeadTraffic } from "@/lib/admin/leads";
import {
  campaignSummaries,
  defaultReportRange,
  ORIGIN_FILTER_NOT_INFORMED,
  pageSummaries,
  reportOrders,
  sourceSummaries,
  trafficTotals,
  validDateParam,
  type TrafficReportSummary,
} from "@/lib/admin/reports";
import { isInternalPagePath } from "@/lib/services/origem";
import { formatPrice } from "@/lib/utils/format";

type Params = Record<string, string | string[] | undefined>;

const PERCENTUAL = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const CAMPO = "mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm";

/**
 * CONTROLE DE TRÁFEGO — de onde vêm os clientes.
 *
 * Só atribuição first-party, como o dono decidiu: a origem que o próprio site
 * anota no navegador (UTM, anúncio, site de origem) e grava nos atendimentos e
 * pedidos. Não há contagem de visitas nem ferramenta de terceiros; o que se
 * mede é quem chamou no WhatsApp, finalizou pedido ou foi lançado no painel.
 */
export default async function TrafegoPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOwner();
  const params = await searchParams;
  const fallback = defaultReportRange();
  const from = validDateParam(params.de, fallback.from);
  const to = validDateParam(params.ate, fallback.to);

  const [state, trafego, produtos, categorias] = await Promise.all([
    readCatalogState(),
    listLeadTraffic({ from, to }),
    getAdminProducts(),
    getAdminCategories(),
  ]);
  const orders = reportOrders(state, { from, to, status: "all" });
  const totais = trafficTotals(orders, trafego.rows);
  const porOrigem = sourceSummaries(orders, trafego.rows);
  const porCampanha = campaignSummaries(orders, trafego.rows);
  const paginas = pageSummaries(trafego.rows);
  const periodo = `de=${from}&ate=${to}`;

  // Destinos do gerador de links: só páginas públicas que existem.
  const destinos: LinkDestinationGroup[] = [
    {
      label: "Páginas da loja",
      options: [
        { label: "Página inicial", path: "/" },
        { label: "Ofertas", path: "/ofertas" },
        { label: "Mais vendidos", path: "/mais-vendidos" },
      ],
    },
    {
      label: "Categorias",
      options: categorias.filter((categoria) => categoria.active).map((categoria) => ({ label: categoria.name, path: `/categoria/${categoria.slug}` })),
    },
    {
      label: "Produtos",
      options: produtos
        .filter((produto) => produto.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .map((produto) => ({ label: produto.name, path: `/produto/${produto.slug}` })),
    },
  ].filter((grupo) => grupo.options.length > 0);

  return (
    <>
      <AdminPageHeader
        eyebrow="Controle de tráfego"
        title="De onde vêm os clientes"
        description="Atendimentos e pedidos por origem e campanha, com a origem registrada pelo próprio site — sem Google Analytics, Pixel ou contagem de visitas."
        actions={<a href="#gerador-de-links" className="rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-extrabold text-ink-950 hover:bg-gold-300">Criar link de campanha</a>}
      />

      <PanelCard>
        <form className="flex flex-wrap items-end gap-3">
          <label className="w-44 text-xs font-bold text-ink-600">Data inicial<input type="date" name="de" defaultValue={from} className={CAMPO} /></label>
          <label className="w-44 text-xs font-bold text-ink-600">Data final<input type="date" name="ate" defaultValue={to} className={CAMPO} /></label>
          <button className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-bold text-white">Atualizar</button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <RangeLink label="Este mês" from={fallback.from} to={fallback.to} />
          <RangeLink label="Últimos 30 dias" {...ultimosDias(30)} />
          <RangeLink label="Mês anterior" {...mesAnterior()} />
        </div>
      </PanelCard>

      {/* Qual migration falta e o que ela quebra: sem a 202609210003 os pedidos
          novos chegam sem origem, e a tabela "Por origem" só mostraria o
          sintoma ("Não informado" crescendo). */}
      <CrmMigrationNotice className="mt-5" />
      {trafego.unavailable && (
        <div role="status" className="mt-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Os atendimentos não puderam ser lidos agora. Os números abaixo mostram só os pedidos. Se o aviso amarelo acima não aparece, foi uma falha passageira: atualize a página.
        </div>
      )}
      {trafego.truncated && (
        <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O período tem mais de {LEAD_REPORT_LIMIT.toLocaleString("pt-BR")} atendimentos: as contas olham só os mais recentes. Escolha um período menor para números exatos.
        </div>
      )}
      {trafego.partial && (
        <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A leitura dos atendimentos parou no meio: os números olham só os {trafego.rows.length.toLocaleString("pt-BR")} mais recentes do período. Atualize a página para tentar de novo.
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Atendimentos" value={String(totais.leads)} detail="Cliques no WhatsApp, pedidos do site e lançados no painel" />
        <Metric title="Pedidos finalizados" value={String(totais.orders)} detail="Sem contar marketplaces (Shopee, Mercado Livre, Magalu)" />
        {/* Só pedido que pode ter atendimento entra na conta: lançamento do grupo e do painel não gera atendimento e levaria o card acima de 100%. */}
        <Metric title="Conversão" value={totais.conversion === null ? "—" : PERCENTUAL.format(totais.conversion)} detail={`${totais.funnelOrders} pedido(s) do site ÷ atendimentos. Os lançados no painel e no grupo não entram.`} tone="green" />
        <Metric title="Vendas finalizadas" value={formatPrice(totais.salesCents)} detail="Dos mesmos pedidos, sem marketplaces" tone="gold" />
      </div>

      <PanelCard className="mt-5">
        <h2 className="text-base font-black">Por origem</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">
          Como o cliente chegou. Pedido sem atendimento (marketplace, lançado no painel ou no grupo) conta só no pedido — por isso a conversão de uma linha pode passar de 100%. “Não informado” são os pedidos anteriores ao controle de tráfego e os lançamentos do grupo sem origem.
        </p>
        <OriginTable rows={porOrigem} periodo={periodo} vazio="Nenhum atendimento ou pedido finalizado neste período." />
      </PanelCard>

      <PanelCard className="mt-5">
        <h2 className="text-base font-black">Por campanha</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">
          Só entra aqui quem chegou por link com campanha (<code className="rounded bg-ink-50 px-1">utm_campaign</code>). Crie os links no gerador abaixo e use um nome por divulgação.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-ink-400">
              <tr><th className="py-2">Campanha</th><th>Origem</th><th>Atendimentos</th><th>Pedidos finalizados</th><th>Conversão</th><th className="text-right">Vendas</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {porCampanha.map((linha) => (
                <tr key={linha.key}>
                  <td className="py-3 font-bold">
                    {/* A busca de pedidos procura também pela campanha. */}
                    <Link href={`/painel/pedidos?q=${encodeURIComponent(linha.label)}`} className="hover:underline">{linha.label}</Link>
                  </td>
                  <td className="text-ink-600">{linha.sourceLabel}</td>
                  <td>{linha.leads}</td>
                  <td>{linha.orders}</td>
                  <td>{linha.conversion === null ? "—" : PERCENTUAL.format(linha.conversion)}</td>
                  <td className="text-right font-black">{formatPrice(linha.salesCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!porCampanha.length && <p className="py-8 text-center text-sm text-ink-500">Nenhum atendimento ou pedido veio de link de campanha neste período.</p>}
        </div>
      </PanelCard>

      <PanelCard className="mt-5">
        <h2 className="text-base font-black">Páginas que geraram atendimento</h2>
        <p className="mt-1 text-xs text-ink-500">De qual página o cliente clicou no WhatsApp ou finalizou o pedido (/checkout).</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase text-ink-400"><tr><th className="py-2">Página</th><th>Atendimentos</th><th className="text-right">Do total</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {paginas.map((linha) => (
                <tr key={linha.path || "sem-pagina"}>
                  <td className="py-2.5 font-mono text-xs">
                    {/* O caminho vem da rota pública: só vira link quando é página da loja. Registro antigo com endereço de fora aparece como texto. */}
                    {!linha.path
                      ? <span className="font-sans text-ink-400">Página não registrada (lançado no painel)</span>
                      : isInternalPagePath(linha.path)
                        ? <a href={linha.path} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{linha.path}</a>
                        : <span className="break-all text-ink-500">{linha.path}</span>}
                  </td>
                  <td>{linha.leads}</td>
                  <td className="text-right">{PERCENTUAL.format(linha.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!paginas.length && <p className="py-8 text-center text-sm text-ink-500">Nenhum atendimento neste período.</p>}
        </div>
      </PanelCard>

      <PanelCard className="mt-5">
        <div id="gerador-de-links" className="scroll-mt-6">
          <h2 className="text-base font-black">Gerador de links de campanha</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-500">
            O Instagram e o WhatsApp abrem o site sem dizer de onde o cliente veio — sem um link marcado, essas visitas somam como “Direto”. Monte aqui o link para a bio, o post, o status ou o anúncio: quem entrar por ele fica registrado na origem e na campanha por 90 dias.
          </p>
          <div className="mt-5">
            <CampaignLinkBuilder siteUrl={site.url} destinations={destinos} />
          </div>
        </div>
      </PanelCard>
    </>
  );
}

function OriginTable({ rows, periodo, vazio }: { rows: TrafficReportSummary[]; periodo: string; vazio: string }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs uppercase text-ink-400">
          <tr><th className="py-2">Origem</th><th>Atendimentos</th><th>Pedidos finalizados</th><th>Conversão</th><th className="text-right">Vendas</th></tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((linha) => (
            <tr key={linha.key}>
              <td className="py-3 font-bold">{linha.label}</td>
              <td>
                {/* Atendimento sempre tem origem; a linha "Não informado" só existe para pedido. */}
                {linha.leads > 0 && linha.key !== ORIGIN_FILTER_NOT_INFORMED
                  ? <Link href={`/painel/atendimento?aba=todos&origem=${encodeURIComponent(linha.key)}&${periodo}`} className="text-blue-700 hover:underline">{linha.leads}</Link>
                  : linha.leads}
              </td>
              <td>
                {/* Relatórios filtra pelo mesmo período; a lista de pedidos não tem filtro de data. */}
                {linha.orders > 0
                  ? <Link href={`/painel/financeiro?${periodo}&status=completed&origem=${encodeURIComponent(linha.key)}`} className="text-blue-700 hover:underline">{linha.orders}</Link>
                  : 0}
              </td>
              <td>{linha.conversion === null ? "—" : PERCENTUAL.format(linha.conversion)}</td>
              <td className="text-right font-black">{formatPrice(linha.salesCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="py-8 text-center text-sm text-ink-500">{vazio}</p>}
    </div>
  );
}

function Metric({ title, value, detail, tone = "default" }: { title: string; value: string; detail: string; tone?: "default" | "green" | "gold" }) {
  return (
    <PanelCard className="p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400">{title}</p>
      <p className={`mt-2 text-2xl font-black ${tone === "green" ? "text-green-700" : tone === "gold" ? "text-gold-800" : "text-ink-900"}`}>{value}</p>
      <p className="mt-1 text-xs text-ink-500">{detail}</p>
    </PanelCard>
  );
}

function RangeLink({ label, from, to }: { label: string; from: string; to: string }) {
  return <Link href={`/painel/trafego?de=${from}&ate=${to}`} className="rounded-full border border-ink-200 px-3 py-1.5 font-bold text-ink-600 hover:border-gold-400 hover:bg-gold-50">{label}</Link>;
}

/** Dia YYYY-MM-DD no fuso da loja. */
function diaLocal(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(data);
}

function ultimosDias(dias: number) {
  const agora = new Date();
  return { from: diaLocal(new Date(agora.getTime() - (dias - 1) * 24 * 60 * 60 * 1_000)), to: diaLocal(agora) };
}

function mesAnterior() {
  const [ano, mes] = diaLocal(new Date()).split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, mes - 2, 1));
  const ultimo = new Date(Date.UTC(ano, mes - 1, 0));
  return { from: primeiro.toISOString().slice(0, 10), to: ultimo.toISOString().slice(0, 10) };
}
