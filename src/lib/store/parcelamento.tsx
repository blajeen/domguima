"use client";

import { createContext, useContext } from "react";
import { PARCELAMENTO_PADRAO, type ParcelamentoDaLoja } from "@/lib/catalog/parcelamento";

const ParcelamentoContext = createContext<ParcelamentoDaLoja | null>(null);

/**
 * Tabela da maquininha e chamada ("em até Nx") das Configurações, para o que
 * calcula no navegador: a tabela de parcelas do produto, o total do carrinho
 * e os checkouts. O card e a vitrine já recebem o parcelado pronto do
 * servidor (`Product.cardInstallment`).
 *
 * Há um provider no layout raiz (a gaveta do carrinho) e outro em cada página
 * que mostra parcelas: o layout não é buscado de novo na navegação dentro do
 * site, e só o da página chega com a tabela que o dono acabou de salvar. O
 * provider mais próximo vence.
 */
export function ParcelamentoProvider({ value, children }: { value: ParcelamentoDaLoja; children: React.ReactNode }) {
  return <ParcelamentoContext.Provider value={value}>{children}</ParcelamentoContext.Provider>;
}

/** Fora de provider, a tabela padrão: uma parcela velha custa menos que uma página quebrada. */
export function useParcelamento(): ParcelamentoDaLoja {
  return useContext(ParcelamentoContext) ?? PARCELAMENTO_PADRAO;
}
