import { textLinkStyles } from "@/components/ui/Button";
import { reputacaoDaLoja, type CanalReputacao } from "@/lib/catalog/reputacao";
import { formatDate, formatNota } from "@/lib/utils/format";

/**
 * Prova social sem API. Os números são um retrato público datado e cada canal
 * leva ao perfil oficial, para o visitante conferir tudo na origem. A nota
 * aparece exata e com a data da consulta, sem estrelas de enfeite e sem a
 * marca do canal num quadrado.
 */
export async function ReviewsSection() {
  // Mesma leitura da página de produto (painel primeiro, config/site depois).
  const { google, shopee } = await reputacaoDaLoja();
  return (
    <section aria-labelledby="avaliacoes-titulo" className="border-y border-fio bg-papel-escuro">
      <div className="site-shell grid gap-8 py-10 sm:py-12 lg:grid-cols-3 lg:gap-0">
        <div className="lg:pr-10">
          <h2
            id="avaliacoes-titulo"
            className="text-balance text-titulo font-bold text-grafite-900 sm:text-titulo-lg"
          >
            Avaliações no Google e na Shopee
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-600">
            Números da consulta pública, com a data. O link abre o perfil da loja em cada canal.
          </p>
        </div>
        <Canal canal={google} />
        <Canal canal={shopee} />
      </div>
    </section>
  );
}

function Canal({ canal }: { canal: CanalReputacao }) {
  const nome = `${canal.preposicao} ${canal.canal}`;
  return (
    // Separação por fio: em cima no celular, à esquerda no desktop.
    <div className="border-t border-fio pt-6 lg:border-l lg:border-t-0 lg:px-10 lg:pt-0">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-5xl font-extrabold leading-none tracking-tight tabular-nums text-grafite-900">
          {formatNota(canal.nota)}
        </span>
        <span className="text-sm text-ink-600">de 5 {nome}</span>
      </p>
      <p className="mt-3 text-sm font-semibold text-grafite-900">
        {canal.avaliacoes.toLocaleString("pt-BR")} avaliações
      </p>
      <p className="mt-0.5 text-xs text-ink-500">Consulta pública em {formatDate(canal.consultadoEm)}</p>
      <a
        href={canal.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${textLinkStyles} mt-1`}
      >
        Conferir {nome}
      </a>
    </div>
  );
}
