import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Trilha de navegação. Emite também o JSON-LD BreadcrumbList, que é o que o
 * Google usa para mostrar o caminho no resultado de busca.
 */
export function Breadcrumbs({
  items,
  siteUrl,
}: {
  items: Crumb[];
  siteUrl: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${siteUrl}${item.href}` } : {}),
    })),
  };

  return (
    <>
      <nav aria-label="Você está aqui" className="text-sm">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-ink-400">
          {items.map((item, i) => {
            const last = i === items.length - 1;
            return (
              <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
                {item.href && !last ? (
                  <Link
                    href={item.href}
                    className="transition-colors hover:text-gold-700 hover:underline"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className={last ? "font-medium text-ink-700" : undefined} aria-current={last ? "page" : undefined}>
                    {item.label}
                  </span>
                )}
                {!last && <span aria-hidden className="text-ink-300">/</span>}
              </li>
            );
          })}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
