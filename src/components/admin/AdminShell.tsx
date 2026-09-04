import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/painel/actions";

const nav = [
  { href: "/painel", label: "Visao geral", icon: "⌂" },
  { href: "/painel/produtos", label: "Produtos", icon: "▦" },
  { href: "/painel/pedidos/novo", label: "Novo pedido", icon: "+" },
  { href: "/painel/pedidos", label: "Pedidos", icon: "P" },
  { href: "/painel/ofertas", label: "Ofertas", icon: "%" },
  { href: "/painel/estoque", label: "Estoque", icon: "↕" },
  { href: "/painel/categorias", label: "Categorias", icon: "◇" },
  { href: "/painel/catalogo-pdf", label: "Catalogo PDF", icon: "PDF" },
  { href: "/painel/historico", label: "Historico", icon: "H" },
  { href: "/painel/financeiro", label: "Relatórios", icon: "$" },
  { href: "/painel/configuracoes", label: "Configuracoes", icon: "⚙" },
];

export function AdminShell({ children, ownerName }: { children: ReactNode; ownerName: string }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="admin-no-print border-b border-ink-800 bg-ink-950 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 px-5 py-4 lg:block lg:px-6 lg:py-7">
          <Link href="/painel" className="block">
            <span className="text-xl font-black tracking-tight text-gold-300">DOM GUIMA</span>
            <span className="block text-[10px] uppercase tracking-[0.28em] text-ink-400">Painel da loja</span>
          </Link>
          <Link href="/" target="_blank" className="rounded-lg border border-ink-700 px-3 py-2 text-xs font-bold text-ink-200 hover:border-gold-400 hover:text-gold-300 lg:mt-5 lg:block lg:text-center">
            Ver loja ↗
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:px-4" aria-label="Painel">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-300 transition-colors hover:bg-white/10 hover:text-white">
              <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-white/5 text-[10px] font-black text-gold-300">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-ink-800 px-6 py-5 lg:absolute lg:bottom-0 lg:block lg:w-full">
          <p className="truncate text-sm font-semibold">{ownerName}</p>
          <form action={logoutAction} className="mt-2">
            <button className="text-xs text-ink-400 hover:text-white">Sair do painel</button>
          </form>
        </div>
      </aside>
      {/* `div`, não `main`: o layout raiz já emite <main id="conteudo">, e dois
          landmarks `main` aninhados confundem leitores de tela. */}
      <div className="min-w-0 p-4 sm:p-6 lg:p-8 xl:p-10">{children}</div>
    </div>
  );
}

export function AdminPageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-gold-700">{eyebrow}</p>}
        <h1 className="text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="admin-no-print flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function PanelCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-ink-100 bg-white p-5 shadow-card ${className}`}>{children}</section>;
}
