"use client";

import { PriceTag } from "@/components/ui/PriceTag";
import { parcelamentoMaximo } from "@/lib/catalog/parcelamento";
import { useParcelamento } from "@/lib/store/parcelamento";
import { formatPrice, paymentLines } from "@/lib/utils/format";

/**
 * Totais do pedido, iguais no carrinho, na gaveta e nos dois checkouts: a
 * economia, o frete (sempre combinado depois) e o total com o
 * preço-assinatura e as mesmas frases de Pix e cartão do card. O parcelado do
 * total é calculado sobre a soma, com a mesma tabela da maquininha do card.
 */
export function CartTotals({
  subtotal,
  savings,
  shipping,
  showSubtotal = true,
}: {
  /** Centavos. Sem frete, então é também o total. */
  subtotal: number;
  /** Centavos economizados em relação ao preço "de". */
  savings: number;
  /** Como o frete aparece nesta etapa ("A combinar", "Calculado na próxima etapa"...). */
  shipping: string;
  /** Na gaveta sai: com o frete à parte, o subtotal repetiria o total. */
  showSubtotal?: boolean;
}) {
  const parcelamento = useParcelamento();
  const linhas = subtotal > 0 ? paymentLines(parcelamentoMaximo(subtotal, parcelamento)) : null;
  return (
    <dl className="space-y-2 text-sm">
      {showSubtotal && (
        <Row label="Subtotal">
          <span className="tabular-nums text-grafite-900">{formatPrice(subtotal)}</span>
        </Row>
      )}
      {savings > 0 && (
        <Row label="Você economiza">
          <span className="font-semibold tabular-nums text-oferta">−{formatPrice(savings)}</span>
        </Row>
      )}
      <Row label="Frete">
        <span className="text-ink-600">{shipping}</span>
      </Row>
      <div className="border-t border-fio pt-3">
        <dt className="text-sm font-semibold text-grafite-900">Total</dt>
        <dd className="mt-1.5">
          <PriceTag cents={subtotal} size="compacto" lines={linhas} />
        </dd>
      </div>
    </dl>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-600">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
