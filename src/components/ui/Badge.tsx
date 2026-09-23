export type BadgeVariant = "oferta" | "destaque" | "exclusivo" | "neutro";

// Caixa alta com espaçamento largo só nos selos de venda (desconto, mais
// vendido, exclusivo). O `neutro` mostra um dado comum, como a marca do
// produto, e fica em caixa normal como o resto do texto da loja.
const selo = "font-bold uppercase tracking-[0.06em]";

const styles: Record<BadgeVariant, string> = {
  // Desconto real (−X%). Branco no vermelho-oferta: 5,3:1.
  oferta: `${selo} bg-oferta text-white`,
  // "Mais vendido": ouro-claro sobre grafite.
  destaque: `${selo} bg-grafite-900 text-ouro-claro`,
  // Linha própria "Exclusivos Dom Guima": fio de ouro, texto ouro legível.
  exclusivo: `${selo} bg-white text-ouro-texto ring-1 ring-inset ring-ouro`,
  neutro: "font-semibold bg-papel-escuro text-grafite-700",
};

/** Selo pequeno de canto reto. */
export function Badge({
  variant = "neutro",
  children,
  className = "",
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-card px-1.5 py-1 text-xs leading-none ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
