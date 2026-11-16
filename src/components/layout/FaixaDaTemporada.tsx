"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { TEMAS, TEMPORADAS, temporadaEm, type Temporada } from "@/lib/utils/temporada";

const semAssinatura = () => () => {};
function temaDoNavegador(): Temporada | null {
  const pedido = new URLSearchParams(window.location.search).get("tema");
  return TEMAS.find((tema) => tema === pedido) ?? temporadaEm(new Date());
}

/**
 * Faixa e enfeites das datas do ano (Natal, Virada, Páscoa, Mães, Pais).
 * Decide no navegador, pela data de hoje: páginas estáticas em cache não ficam
 * presas no tema errado. `?tema=natal|virada|pascoa|maes|pais` mostra antes da data.
 */
export function FaixaDaTemporada() {
  // No servidor é null (sem faixa); no navegador lê a data e o ?tema.
  const tema = useSyncExternalStore(semAssinatura, temaDoNavegador, () => null);
  useEffect(() => {
    if (!tema) return;
    document.documentElement.dataset.tema = tema;
    return () => { delete document.documentElement.dataset.tema; };
  }, [tema]);
  if (!tema) return null;
  const info = TEMPORADAS[tema];
  return <>
    <div className={`faixa-temporada faixa-${tema}`} data-storefront-chrome>
      {/* Bolas de Natal penduradas nas pontas (só desktop). */}
      {tema === "natal" && <>
        <span className="bolas-natal bolas-esquerda" aria-hidden><i /><i /><i /></span>
        <span className="bolas-natal bolas-direita" aria-hidden><i /><i /><i /></span>
      </>}
      <div className="site-shell relative flex min-h-10 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 py-1.5 text-center text-xs sm:text-sm">
        <span aria-hidden className="faixa-emoji text-lg">{info.emoji}</span>
        <strong className="font-brand titulo-serifa text-base font-semibold sm:text-xl">{info.titulo}</strong>
        <span className="hidden md:inline">{info.frase}</span>
        <Link href="/ofertas" className="faixa-botao">Ver ofertas →</Link>
      </div>
      {/* Pisca-pisca no pé da faixa do Natal. */}
      {tema === "natal" && <span className="pisca-pisca" aria-hidden />}
    </div>
    {/* Só enfeite: não recebe clique e some para quem desliga animações. */}
    <div className={`enfeite-temporada enfeite-${tema}`} aria-hidden data-storefront-chrome>
      {tema === "virada"
        ? <>
          {Array.from({ length: 6 }, (_, i) => <b key={`f${i}`} className="fogos" style={{ left: `${12 + i * 15}%`, top: `${22 + ((i * 23) % 30)}%`, animationDelay: `${i * 1.1}s` }} />)}
          {Array.from({ length: 16 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 1.7) % 9}s`, animationDuration: `${8 + (i % 5) * 2}s` }} />)}
        </>
        : Array.from({ length: 16 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 1.7) % 9}s`, animationDuration: `${10 + (i % 5) * 2}s` }}>{info.enfeites[i % info.enfeites.length]}</i>)}
    </div>
  </>;
}
