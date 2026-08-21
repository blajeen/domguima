import Link from "next/link";

/** Cabeçalho padrão das vitrines da home. */
export function SectionHeader({
  eyebrow,
  title,
  description,
  href,
  linkLabel = "Ver todos",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-gold-700">
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-ink-500">{description}</p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 whitespace-nowrap rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-semibold text-ink-700 transition-colors hover:border-gold-400 hover:bg-gold-50 hover:text-gold-800"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
