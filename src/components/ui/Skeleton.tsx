export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} aria-hidden />;
}

/** Placeholder de card usado enquanto uma vitrine carrega. */
export function ProductCardSkeleton() {
  return (
    <div className="rounded-card border border-ink-100 bg-white p-3">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="mt-3 h-3 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      <Skeleton className="mt-4 h-6 w-2/3" />
      <Skeleton className="mt-3 h-9 w-full rounded-lg" />
    </div>
  );
}
