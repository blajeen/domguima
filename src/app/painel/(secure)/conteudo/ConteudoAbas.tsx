import Link from "next/link";

const ABAS = [
  { chave: "kit", href: "/painel/conteudo#brand-kit", label: "Brand kit" },
  { chave: "exemplos", href: "/painel/conteudo#exemplos", label: "10 exemplos" },
  { chave: "calendario", href: "/painel/conteudo/calendario", label: "Calendário" },
];

/** Abas da área Conteúdo do painel. */
export function ConteudoAbas({ ativa }: { ativa: string }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2 text-sm font-bold" aria-label="Conteúdo">
      {ABAS.map((a) => (
        <Link key={a.chave} href={a.href} aria-current={a.chave === ativa ? "page" : undefined} className={a.chave === ativa ? "rounded-lg bg-ink-900 px-3 py-2 text-white" : "rounded-lg border border-ink-200 px-3 py-2"}>
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
