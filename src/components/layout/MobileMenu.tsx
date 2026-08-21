"use client";

import Link from "next/link";
import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { social } from "@/config/site";
import type { Category } from "@/lib/catalog/types";
import { genericMessage, whatsappLink } from "@/lib/services/whatsapp";

/** Menu lateral do celular — mesma navegação do desktop, em formato de gaveta. */
export function MobileMenu({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);

  /**
   * Fecha a gaveta quando qualquer link dentro dela é clicado. Um handler só,
   * por delegação, em vez de repetir onClick em cada item — e sem efeito
   * observando a rota, que dispararia re-render extra a cada navegação.
   */
  function closeOnLinkClick(event: React.MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className="-ml-1 rounded-lg p-2 text-white transition-colors hover:bg-white/10 lg:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} title="Menu" side="left">
        <nav
          className="p-2"
          aria-label="Navegação principal"
          onClick={closeOnLinkClick}
        >
          <Item href="/ofertas" icon="🔥" highlight>
            Ofertas
          </Item>
          <Item href="/mais-vendidos" icon="⭐">
            Mais vendidos
          </Item>

          <p className="px-3 pb-1 pt-4 text-xs font-bold uppercase tracking-wider text-ink-400">
            Categorias
          </p>
          {categories.map((category) => (
            <Item
              key={category.id}
              href={`/categoria/${category.slug}`}
              icon={category.icon}
            >
              {category.name}
            </Item>
          ))}

          <p className="px-3 pb-1 pt-4 text-xs font-bold uppercase tracking-wider text-ink-400">
            Atendimento
          </p>
          <Item href="/institucional/contato" icon="💬">
            Fale com a gente
          </Item>
          <Item href="/institucional/frete-e-entrega" icon="🚚">
            Frete e entrega
          </Item>
          <Item href="/institucional/trocas-e-devolucoes" icon="↩️">
            Trocas e devoluções
          </Item>

          <div className="mt-4 space-y-2 border-t border-ink-100 p-3">
            <a
              href={whatsappLink(genericMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white"
            >
              Falar no WhatsApp
            </a>
            <a
              href={social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700"
            >
              Instagram
            </a>
            <a
              href={social.shopee}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700"
            >
              Nossa loja na Shopee
            </a>
          </div>
        </nav>
      </Drawer>
    </>
  );
}

function Item({
  href,
  icon,
  children,
  highlight = false,
}: {
  href: string;
  icon: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors hover:bg-ink-50 ${
        highlight ? "font-bold text-promo" : "font-medium text-ink-700"
      }`}
    >
      <span aria-hidden className="w-5 text-center">
        {icon}
      </span>
      {children}
    </Link>
  );
}
