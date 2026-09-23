"use client";

import { type RefObject, useEffect, useEffectEvent } from "react";

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogos abertos agora, do mais antigo ao mais novo. Esc e Tab valem só
 * para o de cima: a escolha do atendente abre por cima da gaveta do menu, e
 * um Esc fecharia as duas de uma vez.
 */
const abertos: object[] = [];

/**
 * Comportamento de diálogo modal (as gavetas e a escolha do atendente): foca o
 * primeiro elemento útil do painel, prende o Tab dentro dele, fecha no Esc,
 * trava a rolagem da página e, ao fechar, devolve o foco a quem abriu.
 *
 * Enquanto houver algum aberto, o <html> leva `data-modal`: o header usa para
 * desligar o vidro dele, que fica coberto pela tinta do diálogo.
 *
 * `focoInicial` troca o primeiro foco (seletor CSS): na escolha do atendente
 * ele vai para a primeira opção, e não para o botão de fechar.
 */
export function useDialogoModal(
  painel: RefObject<HTMLElement | null>,
  aberto: boolean,
  fechar: () => void,
  focoInicial: string = FOCAVEIS,
) {
  // Quem usa costuma passar uma função nova a cada render (`() => setOpen(false)`).
  // Como dependência, ela refazia o efeito a cada render com o diálogo aberto
  // (na gaveta de filtros, a cada clique), e o foco pulava para o primeiro botão.
  const aoFechar = useEffectEvent(fechar);

  useEffect(() => {
    if (!aberto) return;

    const este = {};
    abertos.push(este);
    document.documentElement.toggleAttribute("data-modal", true);
    const anterior = document.activeElement as HTMLElement | null;

    // Trava a rolagem sem deslocar o layout (o body tem scrollbar-gutter). O
    // valor anterior volta no fim: com um diálogo sobre o outro, o de baixo
    // continua travando.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    painel.current?.querySelector<HTMLElement>(focoInicial)?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (abertos[abertos.length - 1] !== este) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        aoFechar();
        return;
      }
      if (event.key !== "Tab" || !painel.current) return;

      const nos = Array.from(painel.current.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
        (el) => el.offsetParent !== null,
      );
      if (nos.length === 0) return;

      const primeiro = nos[0];
      const ultimo = nos[nos.length - 1];
      // O foco pode ter saído do painel (clique no fundo): o Tab o traz de volta.
      const dentro = painel.current.contains(document.activeElement);

      if (event.shiftKey && (document.activeElement === primeiro || !dentro)) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && (document.activeElement === ultimo || !dentro)) {
        event.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      abertos.splice(abertos.indexOf(este), 1);
      document.documentElement.toggleAttribute("data-modal", abertos.length > 0);
      document.body.style.overflow = overflow;
      anterior?.focus({ preventScroll: true });
    };
  }, [aberto, painel, focoInicial]);
}
