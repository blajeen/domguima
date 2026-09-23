"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Icon, type IconName } from "@/components/ui/Icon";
import { social } from "@/config/site";
import { categoryIcon } from "@/lib/catalog/categories";
import type { Category } from "@/lib/catalog/types";
import { contactsFor, genericMessage } from "@/lib/services/whatsapp";
import { WhatsAppChooser } from "./WhatsAppChooser";

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
        <Icon name="menu" size={24} />
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} title="Menu" side="left">
        <nav
          className="p-2"
          aria-label="Navegação principal"
          onClick={closeOnLinkClick}
        >
          {/* Destaque pelo texto, sem ícone de fogo ou estrela. */}
          <Item href="/ofertas" highlight>
            Ofertas
          </Item>
          <Item href="/mais-vendidos">Mais vendidos</Item>

          <p className="px-3 pb-1 pt-4 text-sm font-semibold text-ink-500">Categorias</p>
          {categories.map((category) => (
            <Item
              key={category.id}
              href={`/categoria/${category.slug}`}
              icon={categoryIcon(category)}
            >
              {category.name}
            </Item>
          ))}

          <p className="px-3 pb-1 pt-4 text-sm font-semibold text-ink-500">Atendimento</p>
          <Item href="/institucional/contato" icon="conversa">
            Fale com a gente
          </Item>
          <Item href="/institucional/frete-e-entrega" icon="caminhao">
            Frete e entrega
          </Item>
          <Item href="/institucional/trocas-e-devolucoes" icon="troca">
            Trocas e devoluções
          </Item>

          <div className="mt-4 space-y-2 border-t border-ink-100 p-3">
            <WhatsAppChooser
              message={genericMessage}
              contacts={contactsFor()}
              className={buttonStyles({ variant: "whatsapp", fullWidth: true })}
            >
              <Icon name="whatsapp" />
              Falar no WhatsApp
            </WhatsAppChooser>
            <a
              href={social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles({ variant: "secundario", fullWidth: true })}
            >
              <Icon name="instagram" />
              Instagram
            </a>
            <a
              href={social.shopee}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles({ variant: "secundario", fullWidth: true })}
            >
              <Icon name="shopee" />
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
  /** Sem ícone o item fica só no texto (Ofertas, Mais vendidos). */
  icon?: IconName;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors hover:bg-ink-50 ${
        highlight ? "font-bold text-oferta" : "font-medium text-ink-700"
      }`}
    >
      {icon && <Icon name={icon} className="text-ink-500" />}
      {children}
    </Link>
  );
}
