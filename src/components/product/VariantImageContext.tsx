"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

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
  src: string | null;
  escolher: (src: string | null) => void;
}

const VariantImageContext = createContext<VariantImage>({ src: null, escolher: () => {} });

export function VariantImageProvider({
  initialSrc = null,
  children,
}: {
  initialSrc?: string | null;
  children: React.ReactNode;
}) {
  const [src, setSrc] = useState<string | null>(initialSrc);
  const escolher = useCallback((valor: string | null) => setSrc(valor), []);
  const value = useMemo(() => ({ src, escolher }), [src, escolher]);
  return <VariantImageContext.Provider value={value}>{children}</VariantImageContext.Provider>;
}

export function useVariantImage(): VariantImage {
  return useContext(VariantImageContext);
}
