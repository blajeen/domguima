"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Pedido do seletor para a galeria. É um objeto novo a cada clique: marcar de
 * novo a mesma opção também traz a foto dela de volta. `src` null é opção sem
 * foto própria, e aí a galeria volta para a capa em vez de ficar na foto da
 * cor escolhida antes.
 */
export interface PedidoDeFoto {
  src: string | null;
}

/**
 * Liga a escolha da variação à galeria do produto.
 *
 * O seletor de cor e a galeria são componentes irmãos em colunas diferentes do
 * layout, então a foto escolhida vive aqui em cima em vez de num deles. Sem
 * isso, clicar em "Preto" trocaria o preço mas continuaria mostrando a foto
 * genérica — que é justamente a queixa que originou este recurso.
 *
 * O valor inicial vem do servidor (a foto da primeira opção com estoque), para
 * a página já abrir na imagem certa sem um efeito que pisca depois da montagem.
 */
interface VariantImage {
  /** Último pedido do seletor, ou null depois que o cliente mexe na galeria. */
  pedido: PedidoDeFoto | null;
  /** O seletor pede a foto da opção marcada (null: a opção não tem foto). */
  escolher: (src: string | null) => void;
  /** Gesto do cliente na galeria: o pedido do seletor deixa de valer. */
  liberar: () => void;
}

const VariantImageContext = createContext<VariantImage>({
  pedido: null,
  escolher: () => {},
  liberar: () => {},
});

export function VariantImageProvider({
  initialSrc = null,
  children,
}: {
  initialSrc?: string | null;
  children: React.ReactNode;
}) {
  const [pedido, setPedido] = useState<PedidoDeFoto | null>(() =>
    initialSrc ? { src: initialSrc } : null,
  );
  const escolher = useCallback((src: string | null) => setPedido({ src }), []);
  const liberar = useCallback(() => setPedido(null), []);
  const value = useMemo(() => ({ pedido, escolher, liberar }), [pedido, escolher, liberar]);
  return <VariantImageContext.Provider value={value}>{children}</VariantImageContext.Provider>;
}

export function useVariantImage(): VariantImage {
  return useContext(VariantImageContext);
}
