"use client";

import { createContext, useContext } from "react";
import { whatsappContacts, type WhatsappContact } from "@/config/site";
import type { LeadDistributionMode } from "@/lib/admin/types";

export interface AttendantsValue {
  /** Quem o cliente pode escolher no dialogo do WhatsApp, na ordem configurada no painel. */
  contacts: WhatsappContact[];
  mode: LeadDistributionMode;
}

const AttendantsContext = createContext<AttendantsValue | null>(null);

/**
 * Lista de atendentes lida UMA vez no layout raiz (server) e distribuida para
 * todos os botoes de WhatsApp do site — header, rodape, flutuante, menu,
 * produto, pedido rapido. Antes cada ponto montava a propria lista, e cinco
 * deles ignoravam o numero configurado no painel.
 */
export function AttendantsProvider({ value, children }: { value: AttendantsValue; children: React.ReactNode }) {
  return <AttendantsContext.Provider value={value}>{children}</AttendantsContext.Provider>;
}

/**
 * Fora do provider devolve a lista estatica em vez de lancar: um botao de
 * WhatsApp que quebra a pagina custa mais caro do que um contato desatualizado.
 */
export function useAttendants(): AttendantsValue {
  return useContext(AttendantsContext) ?? { contacts: [...whatsappContacts], mode: "customer_choice" };
}
