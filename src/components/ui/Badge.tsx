type Variant = "promo" | "best" | "gold" | "neutral" | "success";

const styles: Record<Variant, string> = {
  promo: "bg-promo text-white",
  best: "bg-ink-900 text-gold-300",
  gold: "bg-gold-400 text-ink-900",
  neutral: "bg-ink-100 text-ink-600",
  success: "bg-success-light text-success",
};

export function Badge({
  variant = "neutral",
  children,
  className = "",
}: {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
