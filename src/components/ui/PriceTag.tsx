import {
  discountPercent,
  formatPrice,
  priceParts,
  type PaymentLines,
} from "@/lib/utils/format";

export type PriceTagSize = "compacto" | "card" | "destaque" | "produto";

const sizes: Record<
  PriceTagSize,
  { price: string; discount: string; old: string; lines: string }
> = {
  // Carrinho (cada item e o total), resumos do checkout e barra fixa. É o
  // menor tamanho: abaixo de 1,5rem o piso de 12 px do "R$" e dos centavos
  // passa de meio corpo e o preço perde o desenho de cartaz.
  compacto: { price: "text-[1.5rem]", discount: "text-xs", old: "text-xs", lines: "text-xs" },
  // Card de produto.
  card: { price: "text-[2rem]", discount: "text-sm", old: "text-xs", lines: "text-xs" },
  // Banner e faixa de ofertas da home: maior que o card, para a vitrine ter
  // um momento de preço de cartaz, e bem abaixo da página de produto, que
  // continua sendo o maior preço do site.
  destaque: {
    price: "text-[2.5rem] sm:text-[2.75rem]",
    discount: "text-base",
    old: "text-xs",
    lines: "text-xs sm:text-apoio",
  },
  // Bloco de compra da página de produto.
  produto: {
    price: "text-[3.75rem] sm:text-[4.25rem]",
    discount: "text-xl",
    old: "text-sm",
    lines: "text-sm",
  },
};

const tones = {
  // Sobre papel ou branco.
  grafite: {
    price: "text-grafite-900",
    pix: "text-grafite-900",
    card: "text-ink-500",
    old: "text-ink-500",
    discount: "text-oferta",
  },
  // Sobre grafite ou vidro escuro. O vermelho-oferta como texto no grafite fica
  // em 3,2:1; ali o percentual vira um selo pequeno (branco no vermelho, 5,3:1).
  // Tudo em papel sólido: no vidro escuro com a página branca atrás, o papel
  // já fica no limite (4,5:1), e papel/80 ou /70 cairiam para 3,6 e 3,1:1. O
  // preço "de" se distingue pelo riscado e pelo tamanho, não pela cor.
  papel: {
    price: "text-papel",
    pix: "text-papel",
    card: "text-papel",
    old: "text-papel",
    discount: "rounded-card bg-oferta px-1 py-0.5 text-white",
  },
} as const;

/**
 * Preço-assinatura da loja: "R$" pequeno no alto, reais grandes em Archivo
 * condensado e centavos pequenos sobrescritos. É o único texto desse tamanho
 * no site e aparece igual em card, página de produto, carrinho e barra fixa.
 *
 * O leitor de tela ouve o valor normal ("R$ 129,90"); o desenho em partes fica
 * escondido dele. Componente sem estado: serve em server e client components.
 */
export function PriceTag({
  cents,
  oldCents,
  lines,
  size = "card",
  tone = "grafite",
  className = "",
}: {
  /** Preço em centavos. */
  cents: number;
  /** Preço "de" em centavos. Só aparece (riscado, com o −X%) se for maior que `cents`. */
  oldCents?: number;
  /** Linhas de apoio montadas por `paymentLines` — nunca texto solto. */
  lines?: PaymentLines | null;
  size?: PriceTagSize;
  tone?: keyof typeof tones;
  className?: string;
}) {
  const s = sizes[size];
  const t = tones[tone];
  const { reais, centavos } = priceParts(cents);
  const discount = discountPercent(cents, oldCents);

  return (
    // `relative`: os textos sr-only abaixo são position:absolute. Sem um
    // ancestral posicionado por perto, eles se posicionavam pela página e, nos
    // cards fora da tela dos carrosséis da home, escapavam do overflow-hidden
    // do card e alargavam a página em milhares de px (rolagem lateral).
    <div className={`relative flex flex-col ${className}`}>
      {discount > 0 && oldCents !== undefined && (
        <p className={`${s.old} ${t.old}`}>
          <span className="sr-only">Preço anterior: </span>
          <s>{formatPrice(oldCents)}</s>
        </p>
      )}

      <p className="flex flex-wrap items-start gap-x-2">
        <span className="sr-only">
          {formatPrice(cents)}
          {discount > 0 ? `, ${discount}% de desconto` : ""}
        </span>
        <span
          aria-hidden
          className={`flex items-start gap-[0.06em] font-price font-black leading-[0.85] tabular-nums font-stretch-extra-condensed ${s.price} ${t.price}`}
        >
          {/* 0,42em, com piso de 12 px: no tamanho compacto 0,42em daria 10 px. */}
          <span className="mt-[0.2em] text-[length:max(0.42em,0.75rem)] font-bold">R$</span>
          <span>{reais}</span>
          <span className="mt-[0.12em] text-[length:max(0.42em,0.75rem)]">,{centavos}</span>
        </span>
        {discount > 0 && (
          <span
            aria-hidden
            className={`font-price font-extrabold leading-none font-stretch-condensed ${s.discount} ${t.discount}`}
          >
            −{discount}%
          </span>
        )}
      </p>

      {lines && (
        <div className={`mt-1.5 space-y-0.5 leading-snug ${s.lines}`}>
          <p className={`font-medium ${t.pix}`}>{lines.pix}</p>
          {lines.cartao && <p className={t.card}>{lines.cartao}</p>}
        </div>
      )}
    </div>
  );
}
