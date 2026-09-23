import { buttonStyles } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { shopeeStats, social } from "@/config/site";

/**
 * A Shopee já é um canal ativo da loja. Mostrar isso aumenta a confiança de
 * quem está conhecendo o site agora: dá para conferir a reputação lá fora.
 */
export function ShopeeSection() {
  return (
    <section className="overflow-hidden rounded-card border border-fio bg-white">
      <div className="flex flex-col items-start gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
        <Icon name="shopee" size={40} className="text-ouro-texto" />

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold tracking-tight text-ink-900 sm:text-xl">
            Já comprou com a Dom Guima na Shopee?
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
            Nossa loja por lá está ativa desde 2022, com{" "}
            <strong className="font-bold text-ink-900">
              {shopeeStats.ratingCount.toLocaleString("pt-BR")} avaliações
            </strong>{" "}
            e nota{" "}
            <strong className="font-bold text-ink-900">
              {shopeeStats.ratingAverage.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </strong>
            . Se preferir finalizar por lá, o link é este.
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
      </div>
    </section>
  );
}
