"use client";

import { type TransitionEvent, useState } from "react";

/**
 * Vidro só com a superfície parada. backdrop-filter em elemento que se move
 * ou muda de opacidade recompõe o desfoque a cada quadro, e o desfoque nunca
 * anima (especificação visual). Por isso a gaveta, a folha do atendente e as
 * sugestões da busca entram sólidas e viram vidro quando a transição de
 * entrada do painel termina. Ao fechar, o vidro sai na hora, antes do
 * movimento.
 *
 * Devolve se o vidro pode ligar e o `onTransitionEnd` do painel. Navegador
 * sem @starting-style não faz a transição de entrada: o painel fica sólido,
 * como o vidro sem suporte.
 */
export function useVidroParado(visivel: boolean) {
  const [parado, setParado] = useState(false);

  // Fechou: desliga já neste render, e não no fim da saída. Reabrir no meio
  // da saída começa de novo sólido.
  if (!visivel && parado) setParado(false);

  function aoTerminarTransicao(event: TransitionEvent<HTMLElement>) {
    // Só a transição do próprio painel: a dos filhos (cor no hover) também sobe até aqui.
    if (visivel && event.target === event.currentTarget) setParado(true);
  }

  return [visivel && parado, aoTerminarTransicao] as const;
}
