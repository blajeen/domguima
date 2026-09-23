import { buttonStyles } from "@/components/ui/Button";
import { shopeeStats, social } from "@/config/site";
import { formatDate, formatNota } from "@/lib/utils/format";

/**
 * A Shopee já é um canal ativo da loja. Mostrar isso aumenta a confiança de
 * quem está conhecendo o site agora: dá para conferir a reputação lá fora.
 * Bloco de papel com fio, sem ícone de enfeite: os números, com a data da
 * consulta, e o link para a loja de lá.
 */
export function ShopeeSection() {
  const [ano, mes] = shopeeStats.openedAt.split("-").map(Number);
  const aberta = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <section
      aria-labelledby="shopee-titulo"
      className="flex flex-col items-start gap-6 rounded-card border border-fio bg-white p-6 sm:flex-row sm:items-center sm:p-8"
    >
      <div className="min-w-0 flex-1">
        <h2 id="shopee-titulo" className="text-balance text-titulo font-bold text-grafite-900">
          Já comprou com a Dom Guima na Shopee?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
          Nossa loja por lá está ativa desde {aberta}, com{" "}
          <strong className="font-semibold text-grafite-900">
            {shopeeStats.ratingCount.toLocaleString("pt-BR")} avaliações
          </strong>{" "}
          e nota <strong className="font-semibold text-grafite-900">{formatNota(shopeeStats.ratingAverage)}</strong>{" "}
          (consulta em {formatDate(shopeeStats.verifiedAt)}). Se preferir finalizar por lá, o link é este.
        </p>
      </div>

      <a
        href={social.shopee}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonStyles({ variant: "secundario", size: "lg", className: "w-full shrink-0 sm:w-auto" })}
      >
        Visitar nossa loja na Shopee
      </a>
    </section>
  );
}
