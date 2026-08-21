import { shopeeStats, social } from "@/config/site";

/**
 * A Shopee já é um canal ativo da loja. Mostrar isso aumenta a confiança de
 * quem está conhecendo o site agora: dá para conferir a reputação lá fora.
 */
export function ShopeeSection() {
  return (
    <section className="overflow-hidden rounded-card border border-ink-100 bg-white shadow-card">
      <div className="flex flex-col items-start gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EE4D2D] text-2xl"
        >
          🛍️
        </span>

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
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#EE4D2D] px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-white transition-transform duration-200 hover:scale-[1.02] active:scale-95 sm:w-auto"
        >
          Visitar nossa loja na Shopee
          <span aria-hidden>→</span>
        </a>
      </div>
    </section>
  );
}
