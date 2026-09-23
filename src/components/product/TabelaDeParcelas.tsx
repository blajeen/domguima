"use client";

import { Icon } from "@/components/ui/Icon";
import { tabelaDeParcelas } from "@/lib/catalog/parcelamento";
import { useParcelamento } from "@/lib/store/parcelamento";
import { formatPrice } from "@/lib/utils/format";

/**
 * Parcelas no cartão de crédito, de 1x até a última vez da tabela da
 * maquininha, calculadas sobre o preço à vista com a taxa repassada.
 *
 * "quando o cliente vai fechar sobe essa tabela calculada ja caso seja
 * parcelado" (dono). Na página de produto fica recolhida, abaixo do preço; no
 * checkout abre sozinha quando o cliente escolhe cartão de crédito.
 *
 * Um <details>: abre e fecha antes da hidratação e pelo teclado, sem estado.
 * As duas colunas dependem da largura da PRÓPRIA caixa (container query), não
 * da tela: o resumo do checkout rápido e a coluna do produto são estreitos
 * mesmo no computador, e com colunas pela tela cada valor quebrava ao meio.
 * Os valores nunca quebram por dentro; sem espaço, o total desce para baixo da
 * parcela. A lista é lida de cima para baixo (1x a 9x, depois 10x a 18x).
 */
export function TabelaDeParcelas({
  cents,
  aberta = false,
  rotulo = "Ver parcelas no cartão",
  className = "",
}: {
  /** Preço à vista (Pix ou dinheiro), em centavos. */
  cents: number;
  aberta?: boolean;
  rotulo?: string;
  className?: string;
}) {
  const { taxas } = useParcelamento();
  const linhas = tabelaDeParcelas(cents, taxas);
  if (linhas.length < 2) return null;
  const algumaSemJuros = linhas.some((linha) => linha.taxa === 0);
  const algumaComTaxa = linhas.some((linha) => linha.taxa > 0);

  return (
    <details open={aberta} className={`group rounded-control border border-fio bg-white ${className}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-grafite-900 focus-visible:-outline-offset-2 [&::-webkit-details-marker]:hidden">
        {rotulo}
        <Icon
          name="seta-baixo"
          size={16}
          className="shrink-0 transition-transform duration-(--duracao-toque) ease-out group-open:rotate-180"
        />
      </summary>
      <div className="@container border-t border-fio px-3 pb-3 pt-2">
        <ol className="gap-x-6 text-sm tabular-nums @md:columns-2">
          {linhas.map((linha) => (
            <li
              key={linha.vezes}
              className="flex break-inside-avoid flex-wrap items-baseline justify-between gap-x-3 py-1"
            >
              <span className="whitespace-nowrap text-grafite-900">
                <span className="font-semibold">{linha.vezes}x</span> de {formatPrice(linha.parcela)}
              </span>
              <span className="whitespace-nowrap text-xs text-ink-600">
                {linha.taxa === 0 ? "sem juros" : `total ${formatPrice(linha.total)}`}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs leading-relaxed text-ink-600">
          {algumaComTaxa && algumaSemJuros
            ? "No cartão de crédito. Onde há total, a taxa da maquininha já está no valor da parcela."
            : algumaComTaxa
              ? "No cartão de crédito, com a taxa da maquininha."
              : "No cartão de crédito, sem juros."}{" "}
          À vista no Pix ou dinheiro: {formatPrice(cents)}.
        </p>
      </div>
    </details>
  );
}
