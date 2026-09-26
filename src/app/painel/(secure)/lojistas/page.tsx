import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader, PanelCard } from "@/components/admin/AdminShell";
import { PrintButton } from "@/components/admin/PrintButton";
import { CatalogoLojista } from "@/components/admin/lojistas/CatalogoLojista";
import { EspeciaisForaDaTabela, PrecosEspeciais } from "@/components/admin/lojistas/PrecosEspeciais";
import { VendaLojistasForm } from "@/components/admin/lojistas/VendaLojistasForm";
import { company, whatsapp } from "@/config/site";
import { getOwner } from "@/lib/admin/auth";
import { formatPrice } from "@/lib/utils/format";
import { getAdminProducts, getStoreSettings, getVendaLojistas } from "@/lib/admin/data";
import { especiaisAcimaDoDesconto, especiaisForaDaTabela, formatarDesconto, itensSemPrecoParaLojistas, linhasParaLojistas, mostraPrecoSite } from "@/lib/admin/lojistas";

// O título da aba vira o nome sugerido do arquivo em "Salvar como PDF": sem o
// modelo do painel, sai "Tabela para lojistas - Dom Guima.pdf". Só para a
// conta principal: o título sai no HTML mesmo quando a página manda para o
// login ou dá 404, e nem o nome da área aparece para os outros.
export async function generateMetadata(): Promise<Metadata> {
  const owner = await getOwner();
  return owner?.principal ? { title: { absolute: "Tabela para lojistas - Dom Guima" } } : {};
}

/**
 * Venda para lojistas: desconto geral, preço especial por item e o catálogo em
 * PDF. Só a conta principal (domguima) entra; para as outras, a área nem
 * existe (404), e as actions conferem de novo no servidor.
 */
export default async function LojistasPage() {
  const owner = await getOwner();
  if (!owner?.principal) notFound();

  const [produtos, venda, settings] = await Promise.all([getAdminProducts(), getVendaLojistas(), getStoreSettings()]);
  const linhas = linhasParaLojistas(produtos, venda);
  const semPreco = itensSemPrecoParaLojistas(produtos);
  const guardados = especiaisForaDaTabela(produtos, venda, linhas);
  const acima = especiaisAcimaDoDesconto(linhas);
  const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const descontoRotulo = formatarDesconto(venda.descontoPercent);
  const mostrarPrecoSite = mostraPrecoSite(venda);
  const endereco = settings.fiscalAddress.trim() || `${company.address}, ${company.district}, ${company.cityState}`;

  return <>
    <div className="admin-no-print space-y-6">
      <AdminPageHeader
        title="Venda para lojistas"
        description="Só a conta domguima vê esta área. Nada daqui aparece no site."
        actions={<PrintButton />}
      />
      <PanelCard>
        <h2 className="mb-4 text-lg font-black">Desconto geral</h2>
        <VendaLojistasForm inicial={venda} />
      </PanelCard>
      <PanelCard>
        <h2 className="text-lg font-black">Preço especial por produto</h2>
        <p className="mb-4 mt-1 text-sm text-ink-500">O preço fixo de um item para lojista, no lugar do preço com o desconto geral: pode ser menor ou maior (por exemplo, para arredondar) e não muda quando o desconto geral muda. Vazio volta ao desconto geral. Salve linha por linha ou todos juntos no fim da tabela. Entram os produtos publicados com estoque (uma linha por opção nos que têm variação); esgotado não aparece aqui nem no PDF.</p>
        {semPreco.length > 0 && (
          <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {semPreco.length === 1 ? "1 item publicado e com estoque ficou fora" : `${semPreco.length} itens publicados e com estoque ficaram fora`} por não ter preço à vista no cadastro: <span data-dado-do-dono>{semPreco.join("; ")}</span>.
          </p>
        )}
        {acima.length > 0 && (
          <p role="status" className="mb-4 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-800">
            Preço fixo acima do preço com {descontoRotulo} em {acima.length === 1 ? "1 item" : `${acima.length} itens`}: <span data-dado-do-dono>{acima.map((linha) => `${linha.opcao ? `${linha.nome} · ${linha.opcao}` : linha.nome} (${formatPrice(linha.especialCents ?? 0)})`).join("; ")}</span>. Assim saem no PDF; o desconto geral não mexe neles.
          </p>
        )}
        <EspeciaisForaDaTabela itens={guardados} />
        <PrecosEspeciais linhas={linhas} descontoRotulo={descontoRotulo} mostrarPrecoSite={mostrarPrecoSite} />
      </PanelCard>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Prévia do catálogo</h2>
          <p className="mt-1 text-sm text-ink-500">É exatamente o que sai no PDF. Em &quot;Exportar / salvar PDF&quot;, escolha o destino &quot;Salvar como PDF&quot; e desmarque &quot;Cabeçalhos e rodapés&quot;.</p>
        </div>
        <PrintButton />
      </div>
    </div>
    <div className="mt-4 print:mt-0">
      <CatalogoLojista
        linhas={linhas}
        descontoPercent={venda.descontoPercent}
        condicoes={venda.condicoes}
        mostrarPrecoSite={mostrarPrecoSite}
        whatsapp={settings.whatsappDisplay || whatsapp.display}
        cnpj={settings.cnpj || company.cnpj}
        endereco={endereco}
        data={data}
      />
    </div>
  </>;
}
