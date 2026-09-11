"use client";

import { useEffect, useRef, useState } from "react";
import type { WhatsappContact } from "@/config/site";
import { whatsappLink } from "@/lib/services/whatsapp";

interface WhatsAppChooserProps {
  /** Texto já preenchido na conversa. */
  message?: string;
  contacts: WhatsappContact[];
  /** Classes do botão que dispara a escolha — o mesmo visual do link antigo. */
  className?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}

/**
 * Substitui o link direto do WhatsApp: ao clicar, o cliente escolhe com quem
 * quer falar (dono ou vendedor) e só então a conversa abre em nova aba.
 */
export function WhatsAppChooser({ message, contacts, className, children, ...rest }: WhatsAppChooserProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} aria-haspopup="dialog" {...rest}>
        {children}
      </button>
      <ContactDialog open={open} onClose={() => setOpen(false)} message={message} contacts={contacts} />
    </>
  );
}

function ContactDialog({
  open,
  onClose,
  message,
  contacts,
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
  contacts: WhatsappContact[];
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("a[href]")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Escolha com quem falar no WhatsApp"
        className="relative w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-drawer sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-ink-900">Falar no WhatsApp</h2>
            <p className="mt-0.5 text-sm text-ink-500">Com quem você quer falar?</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1 -mt-1 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <a
                href={whatsappLink(message, contact.number)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl border border-ink-100 px-4 py-3 transition-colors hover:border-[#25D366] hover:bg-[#25D366]/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
                  <WhatsAppIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink-900">{contact.name}</span>
                  <span className="block text-xs text-ink-500">
                    {contact.role} · {contact.display}
                  </span>
                </span>
                <span aria-hidden className="text-ink-400">→</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.38-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
      <path
        fillRule="evenodd"
        d="M12.04 2C6.6 2 2.18 6.42 2.18 11.86c0 1.74.46 3.44 1.32 4.94L2.1 22l5.34-1.4a9.82 9.82 0 0 0 4.6 1.17h.01c5.43 0 9.85-4.42 9.85-9.86 0-2.63-1.02-5.11-2.88-6.97A9.79 9.79 0 0 0 12.04 2Zm0 18.03h-.01a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.16 8.16 0 0 1-1.25-4.36c0-4.52 3.68-8.2 8.2-8.2 2.19 0 4.25.86 5.8 2.41a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.19-8.2 8.19Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
