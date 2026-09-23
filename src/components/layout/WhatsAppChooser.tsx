"use client";

import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buttonStyles } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { useDialogoModal } from "@/components/ui/useDialogoModal";
import { useVidroParado } from "@/components/ui/useVidroParado";
import type { WhatsappContact } from "@/config/site";
import type { LeadKind } from "@/lib/admin/types";
import { atendimentoLink } from "@/lib/services/whatsapp";
import { useAttendants } from "@/lib/store/attendants";

interface WhatsAppChooserProps {
  /** Texto já preenchido na conversa. */
  message?: string;
  /**
   * De onde partiu o contato. É o que o painel mostra como etiqueta do
   * atendimento ("Dúvida de produto", "WhatsApp do site").
   */
  kind?: LeadKind;
  /** Produto que gerou a conversa, quando houver. */
  productId?: string;
  /**
   * Pedido do checkout que acabou de ser enviado. A conversa vai para quem já
   * cuida dele e não abre um segundo atendimento.
   */
  orderId?: string;
  /** Classes do botão que dispara a escolha — o mesmo visual do link antigo. */
  className?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}

/**
 * Substitui o link direto do WhatsApp: ao clicar, o cliente escolhe com quem
 * quer falar (dono ou vendedor) e só então a conversa abre em nova aba.
 *
 * O destino não é mais `wa.me` direto: é a rota `/api/atendimentos/whatsapp`,
 * que registra o atendimento e redireciona. Sem essa passagem, todo contato
 * feito pelo site continuaria invisível para o painel.
 *
 * Quando o painel está em rodízio ou "menos ocupado", não há o que escolher: o
 * diálogo mostra um único botão e o servidor decide quem recebe.
 */
export function WhatsAppChooser({ message, kind = "whatsapp_generic", productId, orderId, className, children, ...rest }: WhatsAppChooserProps) {
  const [open, setOpen] = useState(false);
  const { contacts, mode } = useAttendants();
  const pathname = usePathname();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} aria-haspopup="dialog" {...rest}>
        {children}
      </button>
      <ContactDialog
        open={open}
        onClose={() => setOpen(false)}
        contacts={contacts}
        automatico={mode !== "customer_choice"}
        href={(attendantId) => atendimentoLink({ attendantId, kind, message, pagePath: pathname, productId, orderId })}
      />
    </>
  );
}

/**
 * Painel de vidro claro (bem opaco) sobre uma tinta leve: no celular sobe de
 * baixo, como folha; a partir de sm fica no centro. Vai direto para o <body>
 * (portal): aberto do header ou do rodapé, não herda a cor de texto nem o foco
 * do grafite, nem fica preso na camada deles. Entra com @starting-style, só
 * opacidade e posição, ainda sólido: vira vidro quando para (useVidroParado).
 *
 * Com zoom alto ou o celular deitado, o painel pode ser maior que a tela: ele
 * rola por dentro, e o título e o Fechar continuam alcançáveis.
 */
function ContactDialog({
  open,
  onClose,
  contacts,
  automatico,
  href,
}: {
  open: boolean;
  onClose: () => void;
  contacts: WhatsappContact[];
  automatico: boolean;
  href: (attendantId: string) => string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const textoId = useId();

  // O primeiro foco vai para a primeira opção (link), como antes.
  useDialogoModal(panelRef, open, onClose, "a[href]");
  const [vidro, aoTerminarTransicao] = useVidroParado(open);

  if (!open) return null;

  // Nos modos automáticos o cliente não escolhe: uma opção só, e quem recebe é
  // decidido no servidor na hora do redirect.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-grafite-950/30 transition-opacity duration-(--duracao-entrada) ease-out starting:opacity-0"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={textoId}
        onTransitionEnd={aoTerminarTransicao}
        className={`${vidro ? "glass-light" : "bg-white/96"} relative max-h-full w-full max-w-sm overflow-y-auto overscroll-contain rounded-t-card border-t border-fio p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-grafite-900 shadow-float transition-[opacity,translate] duration-(--duracao-entrada) ease-out starting:translate-y-4 starting:opacity-0 sm:rounded-card sm:border sm:pb-5 sm:starting:translate-y-2`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={tituloId} className="text-lg font-bold text-grafite-900">
              Atendimento no WhatsApp
            </h2>
            <p id={textoId} className="mt-0.5 text-sm text-ink-600">
              {automatico ? "Vamos te conectar com um atendente disponível." : "Com quem você quer falar?"}
            </p>
          </div>
          <IconButton icon="fechar" label="Fechar" onClick={onClose} className="-mr-2.5 -mt-2.5" />
        </div>

        {automatico ? (
          <a
            href={href("auto")}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className={buttonStyles({ variant: "whatsapp", size: "lg", fullWidth: true, className: "mt-5" })}
          >
            <Icon name="whatsapp" />
            Falar no WhatsApp
          </a>
        ) : (
          <ul className="mt-4 space-y-2">
            {contacts.map((contact) => (
              <li key={contact.id}>
                <a
                  href={href(contact.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="group/atendente flex items-center gap-3 rounded-control border border-fio bg-white px-3 py-3 transition-colors duration-(--duracao-toque) hover:border-grafite-900"
                >
                  {/* A inicial no lugar de uma foto: não há foto da equipe no site.
                      Raio de controle, e não pílula: a pílula é só de chip sobre
                      foto, FAB e contador. */}
                  <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-control bg-papel-escuro text-lg font-semibold text-grafite-900"
                  >
                    {contact.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold leading-snug text-grafite-900">{contact.name}</span>
                    <span className="block text-sm leading-snug text-ink-600">{contact.role}</span>
                    <span className="block text-sm leading-snug tabular-nums text-ink-600">{contact.display}</span>
                  </span>
                  {/* O verde marca a ação: a linha inteira é o link. Mesma marca
                      da linha de contato da página de produto. */}
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-control bg-whatsapp text-grafite-900 transition-colors duration-(--duracao-toque) group-hover/atendente:bg-whatsapp-escuro"
                  >
                    <Icon name="whatsapp" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  );
}
