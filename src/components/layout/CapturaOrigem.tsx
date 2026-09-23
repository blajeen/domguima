"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { registrarOrigem } from "@/lib/store/origem-storage";

/**
 * Anota de onde o visitante chegou (UTM do link, anuncio, site de origem,
 * pagina de entrada) no proprio navegador. Nao desenha nada.
 *
 * Client-side de proposito: produto e categoria sao paginas estaticas
 * (revalidate = 300). Ler cookies ou cabecalhos no servidor para isso as
 * tornaria dinamicas; aqui o HTML continua em cache e a captura acontece
 * depois da hidratacao. Por usar `useSearchParams`, o layout raiz o monta
 * dentro de um `<Suspense>` — sem ele o Next desistiria de pre-renderizar a
 * pagina inteira.
 *
 * O painel fica de fora: a navegacao de quem administra a loja nao e trafego.
 */
export function CapturaOrigem() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const busca = searchParams.toString();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/painel")) return;
    registrarOrigem({ pathname, search: busca, referrer: document.referrer });
  }, [pathname, busca]);

  return null;
}
