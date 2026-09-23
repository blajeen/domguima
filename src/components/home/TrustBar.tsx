import { company } from "@/config/site";
import { loadPublicStoreSettings } from "@/lib/catalog/database";
import { reputacaoDaLoja, type CanalReputacao } from "@/lib/catalog/reputacao";
import { formatDate, formatNota } from "@/lib/utils/format";

/**
 * Faixa de confiança: uma linha de texto com dados que dá para conferir
 * (cidade e CNPJ de config/site, notas do Google e da Shopee com a data da
 * consulta). Sem ícone em quadrado nem selo genérico ("Atendimento próximo",
 * "Dados protegidos"), que serviam para qualquer loja.
 */
export async function TrustBar() {
  const [settings, { google, shopee }] = await Promise.all([loadPublicStoreSettings(), reputacaoDaLoja()]);
  const cnpj = settings.cnpj || company.cnpj;
  // A data de abertura é a do CNPJ de config/site. Se o painel trocar o CNPJ,
  // a data deixa de valer para ele e sai da frase.
  const mesmoCnpj = soDigitos(cnpj) === soDigitos(company.cnpj);

  return (
    <section aria-label="Dados da loja" className="border-y border-fio bg-white">
      {/* Uma linha só, com "·" entre os dados, a partir do sm. No celular a
          linha não cabe: cada dado vai numa linha, sem o ponto, que cairia no
          começo das linhas quebradas. */}
      <ul className="site-shell grid gap-1 py-3 text-apoio text-ink-600 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-3 sm:[&>li+li]:before:mr-3 sm:[&>li+li]:before:text-ink-400 sm:[&>li+li]:before:content-['·']">
        <li>{company.cityState}</li>
        <li>
          CNPJ <span className="tabular-nums">{cnpj}</span>
          {mesmoCnpj && `, aberto em ${mesAno(company.openedAt)}`}
        </li>
        <Nota canal={google} />
        <Nota canal={shopee} />
      </ul>
    </section>
  );
}

function Nota({ canal }: { canal: CanalReputacao }) {
  return (
    <li>
      <strong className="font-semibold text-grafite-900">{formatNota(canal.nota)}</strong> {canal.preposicao}{" "}
      {canal.canal} ({canal.avaliacoes.toLocaleString("pt-BR")} avaliações, consulta em{" "}
      {formatDate(canal.consultadoEm)})
    </li>
  );
}

function soDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** "18/03/2020" → "março de 2020". */
function mesAno(data: string): string {
  const [, mes, ano] = data.split("/").map(Number);
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
