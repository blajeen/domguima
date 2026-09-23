"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Icon, type IconName } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { social } from "@/config/site";
import { categoryIcon } from "@/lib/catalog/categories";
import type { Category } from "@/lib/catalog/types";
import { genericMessage } from "@/lib/services/whatsapp";
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
      <IconButton
        icon="menu"
        label="Abrir menu"
        variant="sobre-escuro"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        // A margem negativa alinha o traço do ícone à borda do conteúdo.
        className="-ml-2.5 lg:hidden"
      />

      <Drawer open={open} onClose={() => setOpen(false)} title="Menu" side="left">
        <nav
          className="px-2 py-3"
          aria-label="Navegação principal"
          onClick={closeOnLinkClick}
        >
          {/* Destaque pelo texto, sem ícone de fogo ou estrela. */}
          <Item href="/ofertas" highlight>
            Ofertas
          </Item>
          <Item href="/mais-vendidos">Mais vendidos</Item>

          <Grupo>Categorias</Grupo>
          {categories.map((category) => (
            <Item
              key={category.id}
              href={`/categoria/${category.slug}`}
              icon={categoryIcon(category)}
            >
              {category.name}
            </Item>
          ))}

          <Grupo>Atendimento</Grupo>
          <Item href="/conta" icon="caixa">
            Meus pedidos
          </Item>
          <Item href="/institucional/contato" icon="conversa">
            Fale com a gente
          </Item>
          <Item href="/institucional/frete-e-entrega" icon="caminhao">
            Frete e entrega
          </Item>
          <Item href="/institucional/trocas-e-devolucoes" icon="troca">
            Trocas e devoluções
          </Item>

          <div className="mt-4 space-y-2 border-t border-fio px-1 pt-4">
            <WhatsAppChooser
              message={genericMessage}
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

/** Título de grupo: peso, não caixa alta. */
function Grupo({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pb-1 pt-5 text-sm font-semibold text-ink-600">{children}</p>;
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
      className={`flex min-h-11 items-center gap-3 rounded-control px-3 text-base transition-colors duration-(--duracao-toque) hover:bg-papel ${
        highlight ? "font-semibold text-oferta" : "font-medium text-grafite-900"
      }`}
    >
      {icon && <Icon name={icon} className="text-ink-500" />}
      {children}
    </Link>
  );
}
