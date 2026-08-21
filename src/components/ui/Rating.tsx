interface RatingProps {
  /** 0–5 */
  value: number;
  reviewCount?: number;
  size?: "sm" | "md";
  /** Mostra "(12)" ao lado das estrelas. */
  showCount?: boolean;
  className?: string;
}

/**
 * Estrelas com preenchimento parcial (4,88 mostra a quinta estrela quase cheia).
 * Só renderizamos este componente quando existe nota real — nunca cinco
 * estrelas vazias como enfeite.
 */
export function Rating({
  value,
  reviewCount,
  size = "sm",
  showCount = true,
  className = "",
}: RatingProps) {
  const star = size === "sm" ? "h-3.5 w-3.5" : "h-4.5 w-4.5";
  const text = size === "sm" ? "text-xs" : "text-sm";
  const rounded = Math.round(value * 10) / 10;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div
        className="flex items-center gap-0.5"
        role="img"
        aria-label={`Nota ${rounded.toLocaleString("pt-BR")} de 5`}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.max(0, Math.min(1, value - i));
          return (
            <span key={i} className={`relative ${star}`}>
              <Star className={`${star} absolute inset-0 text-ink-200`} />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className={`${star} text-gold-400`} />
              </span>
            </span>
          );
        })}
      </div>
      {showCount && reviewCount !== undefined && (
        <span className={`${text} text-ink-400`}>({reviewCount})</span>
      )}
    </div>
  );
}

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={className}>
      <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L10 14.78l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L10 1.5z" />
    </svg>
  );
}
