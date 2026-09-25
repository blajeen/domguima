import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/painel/actions";

const nav = [
  { href: "/painel", label: "Visao geral", icon: "⌂" },
  { href: "/painel/produtos", label: "Produtos", icon: "▦" },
  { href: "/painel/pedidos/novo", label: "Novo pedido", icon: "+" },
  { href: "/painel/pedidos", label: "Pedidos", icon: "P" },
  { href: "/painel/atendimento", label: "Atendimento", icon: "☎" },
  { href: "/painel/clientes", label: "Clientes", icon: "☺" },
  { href: "/painel/ofertas", label: "Ofertas", icon: "%" },
  { href: "/painel/estoque", label: "Estoque", icon: "↕" },
  { href: "/painel/categorias", label: "Categorias", icon: "◇" },
  { href: "/painel/catalogo-pdf", label: "Catalogo PDF", icon: "PDF" },
  { href: "/painel/historico", label: "Historico", icon: "H" },
  { href: "/painel/financeiro", label: "Relatórios", icon: "$" },
  { href: "/painel/trafego", label: "Trafego", icon: "↗" },
  // Só a conta principal (domguima) vê. Esconder do menu não é a proteção: a
  // página e as actions conferem no servidor (contaPrincipalOrThrow).
  { href: "/painel/lojistas", label: "Venda p/ lojistas", icon: "L", soPrincipal: true },
  { href: "/painel/configuracoes", label: "Configuracoes", icon: "⚙" },
];

export function AdminShell({ children, ownerName, ownerUsername, contaPrincipal }: { children: ReactNode; ownerName: string; ownerUsername: string; contaPrincipal: boolean }) {
  const inicial = (ownerName.trim().charAt(0) || ownerUsername.charAt(0) || "?").toUpperCase();
  return (
    // print:block: na impressão o menu some (admin-no-print) e, com a grade
    // ligada, o conteúdo caía na coluna de 250px do menu. O catálogo para
    // lojistas saía espremido em 13 páginas.
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_minmax(0,1fr)] print:block">
      {/* Coluna em flex: no computador o menu rola por dentro e o bloco de quem
          está logado fica no fluxo, embaixo. Antes ele era absoluto e cobria os
          últimos itens do menu em telas mais baixas. No celular, quem está
          logado aparece logo abaixo do topo (order), antes do menu. */}
      <aside className="admin-no-print flex flex-col border-b border-ink-800 bg-ink-950 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 px-5 py-4 lg:block lg:shrink-0 lg:px-6 lg:pb-4 lg:pt-6">
          <Link href="/painel" className="block">
            <span className="text-xl font-black tracking-tight text-gold-300">DOM GUIMA</span>
            <span className="block text-[10px] uppercase tracking-[0.28em] text-ink-400">Painel da loja</span>
          </Link>
          <Link href="/" target="_blank" className="rounded-lg border border-ink-700 px-3 py-2 text-xs font-bold text-ink-200 hover:border-gold-400 hover:text-gold-300 lg:mt-4 lg:block lg:text-center">
            Ver loja ↗
          </Link>
        </div>
        <div className="order-1 flex items-center gap-3 border-y border-ink-800 px-5 py-3 lg:order-3 lg:shrink-0 lg:flex-wrap lg:border-b-0 lg:px-6 lg:py-4">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-300/15 text-sm font-black text-gold-300">
            {inicial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Olá, {ownerName}</p>
            <p className="truncate text-xs text-ink-400">
              logado como <span className="font-semibold text-ink-200">{ownerUsername}</span>
            </p>
          </div>
          <form action={logoutAction} className="shrink-0 lg:basis-full">
            <button className="rounded-lg border border-ink-700 px-3 py-2 text-xs font-bold text-ink-200 hover:border-gold-400 hover:text-gold-300 lg:w-full">
              Sair<span className="hidden lg:inline"> do painel</span>
            </button>
          </form>
        </div>
        <nav className="order-2 flex gap-1 overflow-x-auto px-3 py-3 lg:block lg:min-h-0 lg:flex-1 lg:space-y-0.5 lg:overflow-y-auto lg:px-4 lg:py-2 lg:[scrollbar-color:var(--color-ink-500)_transparent] lg:[scrollbar-width:thin]" aria-label="Painel">
          {nav.filter((item) => !("soPrincipal" in item) || contaPrincipal).map((item) => (
            <Link key={item.href} href={item.href} className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-300 transition-colors hover:bg-white/10 hover:text-white lg:py-2">
              <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-white/5 text-[10px] font-black text-gold-300">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      {/* `div`, não `main`: o layout raiz já emite <main id="conteudo">, e dois
          landmarks `main` aninhados confundem leitores de tela. */}
      <div className="min-w-0 p-4 sm:p-6 lg:p-8 xl:p-10 print:p-0">{children}</div>
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
