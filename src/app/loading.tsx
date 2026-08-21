import { ProductCardSkeleton } from "@/components/ui/Skeleton";

/** Esqueleto exibido durante a navegação entre páginas. */
export default function Loading() {
  return (
    <div className="site-shell py-8">
      <div className="skeleton h-4 w-48 rounded" />
      <div className="skeleton mt-4 h-8 w-72 rounded" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {Array.from({ length: 10 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
