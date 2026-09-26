/* eslint-disable @next/next/no-img-element -- no PDF impresso a logo precisa estar carregada na hora: <img> simples, sem lazy do next/image. */
import { company } from "@/config/site";
import { formatarDesconto, type LinhaLojista } from "@/lib/admin/lojistas";
import { formatPrice } from "@/lib/utils/format";

/**
 * O catálogo para lojistas: a prévia na tela é o próprio PDF (Imprimir >
 * Salvar como PDF). Sem fotos, para caber em poucas páginas: duas colunas
 * compactas, agrupadas por categoria. A página A4, as margens e o número de
 * página vêm do `@page lojistas` do admin.css.
 *
 * O cabeçalho de cada tabela (categoria e nomes das colunas) fica no <thead>:
 * quando uma categoria quebra de coluna ou de página, o navegador repete o
 * <thead> no pedaço seguinte, e o lojista não fica com preços soltos sem saber
 * de qual categoria são. O preço do site só aparece se o dono ligar na aba.
 */
export function CatalogoLojista({ linhas, descontoPercent, condicoes, mostrarPrecoSite, whatsapp, cnpj, endereco, data }: {
  linhas: LinhaLojista[];
  descontoPercent: number;
  condicoes: string;
  mostrarPrecoSite: boolean;
  whatsapp: string;
  cnpj: string;
  /** Endereço da loja numa linha (o fiscal das Configurações, ou o do site). */
  endereco: string;
  /** "25/09/2026": o dia em que o PDF foi gerado. */
  data: string;
}) {
  const grupos = new Map<string, LinhaLojista[]>();
  for (const linha of linhas) grupos.set(linha.categoria, [...(grupos.get(linha.categoria) ?? []), linha]);
  const temEspecial = linhas.some((linha) => linha.especialCents !== null && !linha.especialSemEfeito);
  const colunas = mostrarPrecoSite ? 3 : 2;
  const legenda = [mostrarPrecoSite && "em cada linha, o preço no site e o preço para lojista", temEspecial && "◆ marca preço especial"].filter(Boolean).join("; ");
  // Com o preço do site oculto, a abertura também não fala dele: "10% sobre
  // o preço do site" ao lado do preço para lojista entrega o preço do site.
  const itens = `${linhas.length} ${linhas.length === 1 ? "item" : "itens"} em estoque`;
  const introducao = (mostrarPrecoSite ? `${itens}, com ${formatarDesconto(descontoPercent)} de desconto sobre o preço à vista do site.` : `${itens}, com preço para lojista.`)
    + (legenda ? ` ${legenda[0].toUpperCase()}${legenda.slice(1)}.` : "");

  return <article aria-label="Catálogo para lojistas" className="catalogo-lojista mx-auto max-w-[210mm] bg-white px-6 py-7 text-ink-900 shadow-card sm:px-10 sm:py-9 print:max-w-none print:p-0 print:shadow-none">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-gold-400 pb-4">
      <div className="flex items-center gap-3">
        <img src="/brand/logo-dom-guima.png" alt="" width={56} height={56} className="size-14 object-contain" />
        <div>
          <p className="font-brand text-[26px] leading-none text-ink-950">Dom Guima</p>
          <p className="mt-1 text-[10px] text-gold-800">Empório das Ofertas</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[15px] font-black text-ink-950">Tabela para lojistas</p>
        <p className="mt-0.5 text-[10px] text-ink-600">Tabela de {data}</p>
      </div>
    </header>

    <p className="mt-3 text-[10px] leading-relaxed text-ink-700">{introducao}</p>

    {linhas.length === 0
      ? <p className="py-16 text-center text-sm text-ink-500">Nenhum produto com estoque agora.</p>
      : <div className="mt-4 gap-8 sm:columns-2 print:columns-2">
        {[...grupos].map(([categoria, itens]) => <table key={categoria} className="mb-4 w-full border-collapse text-[9.5px] leading-snug">
          <thead>
            <tr>
              <th scope="colgroup" colSpan={colunas} className="border-b border-gold-300 pb-1 text-left text-[11px] font-bold text-ink-950">{categoria}</th>
            </tr>
            <tr className="text-[7.5px] font-semibold text-ink-500">
              <th scope="col" className="pt-1 pr-2 text-left font-semibold">Produto</th>
              {mostrarPrecoSite && <th scope="col" className="pt-1 pr-2 text-right font-semibold">No site</th>}
              <th scope="col" className="pt-1 text-right font-semibold">Lojista</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((linha) => {
              const especial = linha.especialCents !== null && !linha.especialSemEfeito;
              return <tr key={linha.chave} className="break-inside-avoid border-b border-ink-100">
                <td className="py-1 pr-2 align-baseline">
                  <span data-dado-do-dono>{linha.nome}{linha.opcao ? ` · ${linha.opcao}` : ""}</span>
                  <span className="ml-1 whitespace-nowrap text-[8px] text-ink-500">{linha.sku}</span>
                </td>
                {mostrarPrecoSite && <td className="whitespace-nowrap py-1 pr-2 text-right align-baseline text-[8.5px] tabular-nums text-ink-500">{formatPrice(linha.varejoCents)}</td>}
                <td className="whitespace-nowrap py-1 text-right align-baseline font-black tabular-nums text-ink-950">
                  {especial && <><span aria-hidden className="mr-0.5 text-gold-700">◆</span><span className="sr-only">Preço especial: </span></>}
                  {formatPrice(linha.finalCents)}
                </td>
              </tr>;
            })}
          </tbody>
        </table>)}
      </div>}

    <footer className="mt-6 break-inside-avoid border-t border-ink-200 pt-3 text-[9px] leading-relaxed text-ink-600">
      {condicoes && <p className="mb-1.5 whitespace-pre-line font-semibold text-ink-800">Condições: {condicoes}</p>}
      <p>Tabela de {data}, sujeita à disponibilidade de estoque. Pedidos pelo WhatsApp {whatsapp}.</p>
      <p>{company.tradeName} · CNPJ {cnpj} · IE {company.stateRegistration} · {endereco}</p>
    </footer>
  </article>;
}
