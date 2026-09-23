export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-card ${className}`} aria-hidden />;
}

/**
 * Placeholder do card de produto enquanto a vitrine carrega: mesmas medidas
 * do ProductCard (poço quadrado, nome em duas linhas, preço, linhas de
 * pagamento e o espaço do botão), para nada pular quando o card chega.
 * Só o poço pulsa; as linhas ficam chapadas. Com 10 cards na tela, são 10
 * blocos animados em vez de 80.
 */
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-fio bg-white" aria-hidden>
      <div className="skeleton aspect-square w-full border-b border-fio" />
      <div className="p-3">
        <Linha className="h-3 w-1/3" />
        <Linha className="mt-2 h-3.5 w-full" />
        <Linha className="mt-1.5 h-3.5 w-2/3" />
        <Linha className="mt-4 h-7 w-1/2" />
        <Linha className="mt-2 h-3 w-3/4" />
        <Linha className="mt-1.5 h-3 w-full" />
      </div>
      {/* O botão do card só some quando há apenas mouse; no toque fica à vista. */}
      <div className="px-3 pb-3">
        <div className="h-9 w-full rounded-control bg-papel-escuro pointer-coarse:h-11 so-mouse:invisible" />
      </div>
    </div>
  );
}

/** Linha de texto do esqueleto: bloco chapado, sem animação. */
function Linha({ className }: { className: string }) {
  return <div className={`rounded-card bg-papel-escuro ${className}`} />;
}
