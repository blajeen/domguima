import Link from "next/link";
import { textLinkStyles } from "./Button";

/**
 * Cabeçalho das vitrines: título curto e específico à esquerda e a ação
 * ("Ver todos") à direita. Sem rótulo em caixa alta acima nem subtítulo: o
 * cabeçalho de três linhas repetido em toda seção era a cara de template.
 */
export function SectionHeader({
  title,
  href,
  linkLabel = "Ver todos",
  id,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  /** Para a seção apontar o título com aria-labelledby. */
  id?: string;
}) {
  // A margem negativa devolve a sobra da área de toque de 44 px: a linha do
  // título não cresce por causa do link.
  const linkClass = `${textLinkStyles} -my-2.5 shrink-0 whitespace-nowrap`;

  return (
    <div className="mb-4 flex items-baseline justify-between gap-4 sm:mb-5">
      <h2
        id={id}
        className="min-w-0 text-balance text-titulo font-bold text-grafite-900 sm:text-titulo-lg"
      >
        {title}
      </h2>
      {href &&
        (href.startsWith("http") ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {linkLabel}
          </a>
        ) : (
          <Link href={href} className={linkClass}>
            {linkLabel}
          </Link>
        ))}
    </div>
  );
}
